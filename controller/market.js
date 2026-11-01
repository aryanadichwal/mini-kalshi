import { CreateMarketSchema, CreateOrderSchema } from "../types/market"
import { MarketModel } from "../model/markets"
import { orderbookModel ,} from "../model/orderbook"
import mongoose from "mongoose"

import { opposite, addStock , updatemaker, recordTrade, consumeBuyFunds} from "../helpers/market"
import { UserModel } from "../model/user"
import { orderStatus } from "../helpers/market"
import { stockbalanceModel } from "../model/stockbalance"
import { Bid } from "../model/bids"
import { Ask } from "../model/asks"


export async function createMarket(req, res) {
    const { success , data } = CreateMarketSchema.safeParse(req.body)
    if (!success){
        return res.status(400).json({error:"Market title required"})
    }
    let session
    try{
        const existingmarket = await MarketModel.findOne({
            creatorId:req.userId,
            title: data.title
        })

        if(existingmarket){
            return res.status(409).json({error: "You have already created this market"})
        }

        session = await mongoose.startSession()
        let market 
        await session.withTransaction(async ()=>{
            const created = await MarketModel.create([
                {
                    creatorId: req.userId,
                    title: data.title,
                    totalIssued: 0,
                    resolution: null
                }
            ],
            {session}
            )
            market = created[0]
            await orderbookModel.create([
                {
                    marketId: market._id,
                    type: "YES"
                },
                {
                    marketId: market._id,
                    type: "NO"
                }

            ],
            {session, ordered: true }
            )
        })

        return res.status(201).json({
                message: "Market created",
                market: {
                    id : market._id,
                    creatorId: market.creatorId,
                    title: market.title,
                    totalIssued: market.totalIssued,
                    resolution: market.resolution
                }
            })

    } catch (e) {
        console.error(e)
          return res.status(500).json({
            error: "Could not create market"
          })
    } finally {
        if(session){    
            await session.endSession()
        }  
    }
}

export async function createOrder(req, res) {
  const { success, data } = CreateOrderSchema.safeParse(req.body);

  if (!success) {
    return res.status(400).json({ error: "Invalid order request" });
  }

  const { marketId, type, side, price, quantity } = data;

  if (!Number.isSafeInteger(price * quantity)) {
    return res.status(400).json({
      error: "Order amount is too large"
    });
  }

  let session;

  try {
    let result;
    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const market = await MarketModel.findOne({
        _id: marketId,
        resolution: null
      }).session(session);

      if (!market) {
        throw new Error("MARKET_NOT_FOUND");
      }

      const orderbook = await orderbookModel.findOne({
        marketId: marketId,
        type: side
      }).session(session);

      if (!orderbook) {
        throw new Error("ORDERBOOK_NOT_FOUND");
      }

      const userId = req.userId;

      let remainingQty = quantity;
      const oppositeSide = opposite(side);

      // Reserve money or contracts.
      if (type === "buy") {
        const reserved = price * quantity;

        const updated = await UserModel.updateOne(
          {
            _id: userId,
            usdbalance: { $gte: reserved }
          },
          {
            $inc: {
              usdbalance: -reserved,
              lockedusdBalance: reserved
            }
          },
          { session, ordered: true }
        );

        if (updated.matchedCount === 0) {
          throw new Error("INSUFFICIENT_USD");
        }

      } else {
        const stock = await stockbalanceModel.findOne({
          userId,
          marketId,
          type: side
        }).session(session);

        if (!stock || stock.quantity - stock.locked < quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        stock.locked += quantity;
        await stock.save({ session, ordered: true });
      }

      // Every incoming order is recorded permanently.
      const Model = type === "buy" ? Bid : Ask;

      const [incoming] = await Model.create(
        [{
          orderbookId: orderbook._id,
          userId,
          stockType: side,
          action: type,
          price,
          quantity: quantity,
          remainingQty: quantity,
          status: "OPEN"
        }],
        { session, ordered: true }
      );

      const candidates = [];

      if (type === "buy") {
        // Scenario 1: BUY YES <-> SELL YES
        // Or BUY NO <-> SELL NO.
        const asks = await Ask.find({
          orderbookId: orderbook._id,
          stockType: side,
          status: { $in: ["OPEN", "PARTIALLY_FILLED"] },
          remainingQty: { $gt: 0 },
          price: { $lte: price },
          userId: { $ne: userId }
        }).session(session);

        for (const ask of asks) {
          candidates.push({
            order: ask,
            kind: "TRANSFER",
            effectivePrice: ask.price
          });
        }

        // Scenario 2: BUY YES <-> BUY NO.
        const oppositeBook = await orderbookModel.findOne({
          marketId,
          type: oppositeSide
        }).session(session);

        if (!oppositeBook) {
          throw new Error("ORDERBOOK_NOT_FOUND");
        }

        const oppositeBids = await Bid.find({
          orderbookId: oppositeBook._id,
          stockType: oppositeSide,
          status: { $in: ["OPEN", "PARTIALLY_FILLED"] },
          remainingQty: { $gt: 0 },
          price: { $gte: 100 - price },
          userId: { $ne: userId }
        }).session(session);

        for (const bid of oppositeBids) {
          candidates.push({
            order: bid,
            kind: "CREATE",
            effectivePrice: 100 - bid.price
          });
        }

        // Best price, then oldest order.
        candidates.sort((a, b) => {
          if (a.effectivePrice !== b.effectivePrice) {
            return a.effectivePrice - b.effectivePrice;
          }

          const timeDiff =
            new Date(a.order.createdAt) -
            new Date(b.order.createdAt);

          if (timeDiff !== 0) return timeDiff;

          return String(a.order._id)
            .localeCompare(String(b.order._id));
        });

      } else {
        // SELL searches same-side BUY orders.
        const bids = await Bid.find({
          orderbookId: orderbook._id,
          stockType: side,
          status: { $in: ["OPEN", "PARTIALLY_FILLED"] },
          remainingQty: { $gt: 0 },
          price: { $gte: price },
          userId: { $ne: userId }
        })
          .sort({ price: -1, createdAt: 1, _id: 1 })
          .session(session);

        for (const bid of bids) {
          candidates.push({
            order: bid,
            kind: "TRANSFER",
            effectivePrice: bid.price
          });
        }
      }

      let filledQty = 0;

      for (const candidate of candidates) {
        if (remainingQty === 0) break;

        const maker = candidate.order;

        const matchedQty = Math.min(
          remainingQty,
          maker.remainingQty
        );

        const executionPrice = candidate.effectivePrice;

        if (candidate.kind === "CREATE") {
          // Two opposite BUY orders create new pairs.

          await consumeBuyFunds(
            userId,
            price,
            executionPrice,
            matchedQty,
            session
          );

          await consumeBuyFunds(
            maker.userId,
            maker.price,
            maker.price,
            matchedQty,
            session
          );

          await addStock(
            userId, marketId, side, matchedQty, session
          );

          await addStock(
            maker.userId,
            marketId,
            oppositeSide,
            matchedQty,
            session
          );

          // One newly issued pair per matched quantity.
          await MarketModel.updateOne(
            { _id: marketId },
            { $inc: { totalIssued: matchedQty } },
            { session, ordered: true }
          );

          await recordTrade({
            maker,
            taker: incoming,
            makerPrice: maker.price,
            takerPrice: executionPrice,
            quantity: matchedQty,
            session
          });

        } else if (type === "buy") {
          // Incoming BUY matches existing SELL.
          // Transfer existing contracts.

          await consumeBuyFunds(
            userId,
            price,
            executionPrice,
            matchedQty,
            session
          );

          await UserModel.updateOne(
            { _id: maker.userId },
            {
              $inc: {
                usdbalance: executionPrice * matchedQty
              }
            },
            { session, ordered: true }
          );

          const sellerStock = await stockbalanceModel.updateOne(
            {
              userId: maker.userId,
              marketId,
              type: side,
              locked: { $gte: matchedQty },
              quantity: { $gte: matchedQty }
            },
            {
              $inc: {
                quantity: -matchedQty,
                locked: -matchedQty
              }
            },
            { session, ordered: true }
          );

          if (sellerStock.matchedCount !== 1) {
            throw new Error("INCONSISTENT_STOCK");
          }

          await addStock(
            userId, marketId, side, matchedQty, session
          );

          await recordTrade({
            maker,
            taker: incoming,
            makerPrice: executionPrice,
            takerPrice: executionPrice,
            quantity: matchedQty,
            session
          });

        } else {
          // Incoming SELL matches existing BUY.

          await consumeBuyFunds(
            maker.userId,
            maker.price,
            maker.price,
            matchedQty,
            session
          );

          await UserModel.updateOne(
            { _id: userId },
            {
              $inc: {
                usdbalance: maker.price * matchedQty
              }
            },
            { session, ordered: true }
          );

          const sellerStock = await stockbalanceModel.updateOne(
            {
              userId,
              marketId,
              type: side,
              locked: { $gte: matchedQty },
              quantity: { $gte: matchedQty }
            },
            {
              $inc: {
                quantity: -matchedQty,
                locked: -matchedQty
              }
            },
            { session, ordered: true }
          );

          if (sellerStock.matchedCount !== 1) {
            throw new Error("INCONSISTENT_STOCK");
          }

          await addStock(
            maker.userId,
            marketId,
            side,
            matchedQty,
            session
          );

          await recordTrade({
            maker,
            taker: incoming,
            makerPrice: maker.price,
            takerPrice: maker.price,
            quantity: matchedQty,
            session
          });
        }

        await updatemaker(maker, matchedQty, session);

        remainingQty -= matchedQty;
        filledQty += matchedQty;
      }

      incoming.remainingQty = remainingQty;
      incoming.status = orderStatus(remainingQty, quantity);

      await incoming.save({ session, ordered: true });

      result = {
        orderId: incoming._id,
        marketId,
        type,
        side,
        price,
        requestedQty: quantity,
        filledQty,
        remainingQty,
        status: incoming.status
      };
    });

    return res.status(201).json({
      message: "Order processed",
      data: result
    });

  } catch (error) {
    const errors = {
      MARKET_NOT_FOUND: [404, "Unresolved market not found"],
      ORDERBOOK_NOT_FOUND: [404, "Order book not found"],
      INSUFFICIENT_USD: [400, "Insufficient USD balance"],
      INSUFFICIENT_STOCK: [400, "Insufficient unlocked contracts"]
    };

    if (errors[error.message]) {
      const [status, message] = errors[error.message];

      return res.status(status).json({
        error: message
      });
    }

    console.error("createOrder error:", error);

    return res.status(500).json({
      error: "Could not process order"
    });

  } finally {
    await session.endSession();
  }
}
