import { CreateMarketSchema, CreateOrderSchema } from "../types/market"
import { MarketModel } from "../model/markets"
import { orderbookModel ,} from "../model/orderbook"
import mongoose from "mongoose"
import { createOrderModel } from "../model/createorder"
import { opposite, addStock , updatemaker, recordTrade} from "../helpers/market"
import { UserModel } from "../model/user"
import { fillModel } from "../model/fill"
import { stockbalanceModel } from "../model/stockbalance"
import { Bid } from "../model/bids"
import { Ask } from "../model/asks"
import { effect } from "zod/v3"

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

export async function createOrder(req, res){
    const { success, data} = CreateOrderSchema.safeParse(req.body)
    if(!success){
        return res.status(400).json({error:"Invalid order request"})
    }
    const { marketId, type, side, price, quantity } = data

    if (!Number.isSafeInteger(price * quantity)){
        return res.status(400).json({
        error: "Order amount is too large"
        })
    }
    let session
    try{
        let result 
        session = await mongoose.startSession()  
        await session.withTransaction(async()=>{
            const market = await MarketModel.findOne({
                _id: marketId,
                resolution: null
            }).session(session)

            if(!market){
                throw new Error("MARKET_NOT_FOUND")
            }
        
            const orderbook = await orderbookModel.findOne({
                marketId: marketId,
                type: side
            }).session(session)

            if(!orderbook){
                throw new Error("ORDERBOOK_NOT_FOUND")
            }

            const userId = req.userId

            let remainingQty = quantity
            const oppositeSide = opposite(side)

            if (type === "buy") {
                const reserved = price * quantity
                const updated = await UserModel.updateOne(
                {
                _id: userId,
                usdbalance: {$gte: reserved}
                },
                {
                    $inc: {
                        usdbalance: -reserved,
                        lockedusdBalance: reserved
                    }
                },{session})

                if(resrvedResult.matchedCount === 0){
                    throw new Error("INSUFFICIENT_USD")
                }

            } else {

                const stock = await stockbalanceModel.findOne({
                    userId,
                    marketId,
                    type: side
                }).session(session)
                
                if(!stock || stock.quantity - stock.lockedQuantity < quantity){
                    throw new Error("INSUFFICIENT_STOCK")
                }

                stock.lockedQuantity +=quantity
                await stock.save({session})
            }
            
            const Model = type === "buy" ? Bid : Ask

            const [incoming] = await Model.create(
                [{
                    orderbookId: orderbook._id,
                    userId,
                    stockType: side,
                    action: type, 
                    price,
                    qty: quantity,
                    remainingQty: quantity, 
                    status:"OPEN"
                }],
                { session }
            )

            const candidates = []

            if (type == "buy"){
                //BUY YES <-> SELL YES or BUY NO <-> SELL NO
                const ask = await Ask.find({
                    orderbookId: orderbook._id,
                    stockType: side,
                    status: { $in: ["OPEN", "PARTIALLY_FILLED"]},
                    remainingQty: { $gt:0},
                    price: { $lte: price},
                    userId: { $ne : userId}
                }).session(session)

                for (const ask of ask){
                    candidates.push({
                        order: ask,
                        kind: "TRANSFER",
                        effectivePrice: ask.price
                    })
                }

                //BUY YES <-> BUY NO
                const oppositeBook = await orderbookModel.findOne({
                    marketId,
                    type: oppositeSide
                }).session(session)

                if(!oppositeBook){
                    throw new Error("ORDERBOOK_NOT_FOUND")
                }
                const oppositeBids = await Bid.find({
                    orderbookId: orderbook._id,
                    stockType: oppositeSide,
                    status: { $in: ["OPEN", "PARTIALLY_FILLED"]},
                    remainingQty: { $gt: 0},
                    price: { $gte : 100 - price},
                    userId: { $ne : userId}
                }).session(session)

                for (const bid of oppositeBids){
                    candidates.push({
                        order: bid,
                        kind: "CREATE",
                        effectivePrice: 100 - bid.price
                    })
                }
            }   
            })

            


    } catch (e) {
        return res.status(500).json({error:e.message})
    } finally {
        if (session){
            await session.endSession()
        }
    }
}

