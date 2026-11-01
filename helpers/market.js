import mongoose from "mongoose"
import { stockbalanceModel } from "../model/stockbalance"
import { UserModel } from "../model/user"
import { fillModel } from "../model/fill"


export function opposite(side){
    return side === "YES" ? "NO" : "YES"
}

export function orderStatus(remaining, original){
    if ( remaining === 0) return "FILLED"
    if ( remaining == original) return "OPEN"
    return "PARTIALLY_FILLED"
}

export async function addStock( userId, marketId, side, quantity, session ) {
    await stockbalanceModel.updateOne({
        userId, 
        marketId, 
        type: side
    },
        {   
            $inc: { quantity },
            $setOnInsert: { locked: 0}
        },
        { upsert: true, session }
    )
}

export async function updatemaker(order, matchedQty, session){
    order.remainingQty -= matchedQty

    order.status = orderStatus (
        order.remainingQty,
        order.quantity
    )
    await order.save({ session })
} 


export async function consumeBuyFunds(userId, limitPrice, executionPrice, matchedQty, session){    
    const reserved = limitPrice * matchedQty
    const actualcost = executionPrice * matchedQty
    const refund = reserved - actualcost

    await UserModel.updateOne({
        _id: userId
    },
    {
        $inc: {
            lockedusdBalance: -reserved,
            usdbalance: refund
        }
    }, { session })

}

export async function recordTrade({
  maker,
  taker,
  makerPrice,
  takerPrice,
  quantity,
  session
}) {
    const tradeId = new mongoose.Types.ObjectId()

    await fillModel.create([
        {
            tradeId,
            orderId: maker._id,
            orderbookId: maker.orderbookId,
            userId: maker.userId,
            price: makerPrice,
            quantity,
            type: maker.action,
            isMaker: true
        },
        {
            tradeId,
            orderId: taker._id,
            orderbookId: taker.orderbookId,
            userId: taker.userId,
            price: takerPrice,
            quantity,
            type: taker.action,
            isMaker: false
        }
    ], { session, ordered: true })
}


