import { SplitSchema } from "../types/market";
import { transectionModel } from "../model/trancsectionLedger";
import { MarketModel } from "../model/markets";
import mongoose from "mongoose";
import { UserModel } from "../model/user";
import { stockbalanceModel } from "../model/stockbalance"


export async function splitOrder(req,res){
    const { success , data } = SplitSchema.safeParse(req.body)
    if(!success){
        return res.status(401).json({error: "Invalid input"})
    }
    let session
    try {
        const existingMarket = await MarketModel.findById(data.marketId)

        if(!existingMarket){
            throw new Error("MARKET_DOESNOT_EXIST")
        }

        if(existingMarket.resolution !== null){
            return res.status(400).json({error:"MARKET_RESOLVED"})
        }

        
        session = await mongoose.startSession()
        await session.withTransaction(async()=>{

            const user = await UserModel.findById(req.userId).session(session)
            if(!user){
                throw new Error("USER_NOT_FOUND")
            }

            const availableBalance = user.usdbalance - user.lockedusdBalance
            if( availableBalance < data.amount){
                throw new Error("INSUFFICIENT_BALANCE")
            }

            const pair = data.amount
            
            await UserModel.updateOne(
                {_id: req.userId},
                {
                    $inc: {
                        usdbalance: -data.amount,
                    }
                },
                { session, ordered: true}
            )

            const existingYesStockBalance = await stockbalanceModel.findOne({
                userId:req.userId,
                marketId: data.marketId,
                type:"YES"
            }).session(session)

            if(!existingYesStockBalance){
                await stockbalanceModel.create({
                    userId: req.userId,
                    marketId: data.marketId,
                    type:"YES",
                    quantity: pair,
                    locked: 0
                }, {session, ordered: true})
            } else {
                await stockbalanceModel.updateOne({
                    userId: req.userId,
                    marketId: data.marketId,
                    type: "YES"
                    },
                    {
                        $inc:{
                            quantity: pair
                        }
                    },
                    {session , ordered: true}
                )
            }

            const existingNoStockBalance = await stockbalanceModel.findOne({
                userId:req.userId,
                marketId: data.marketId,
                type:"NO"
            }).session(session)

            if(!existingNoStockBalance){
                await stockbalanceModel.create({
                    userId: req.userid,
                    marketId: data.marketId,
                    type:"NO",
                    quantity: pair,
                    locked: 0
                },{session, ordered: true})
            } else {
                await stockbalanceModel.updateOne({
                    userId: req.userId,
                    marketId: data.marketId,
                    type: "NO"
                    },
                    {
                        $inc:{
                            quantity: pair
                        }
                    },
                    {session , ordered: true}
                )
            }
            
            await MarketModel.updateOne({
                _id:data.marketId,
            },{
                $inc:{
                    totalIssued: pair
                }
            }, { session, ordered: true})

        
        })
        
    } catch (error) {
        
    }    
}