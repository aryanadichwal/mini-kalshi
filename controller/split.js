import { SplitSchema } from "../types/market";
import { transectionModel } from "../model/trancsectionLedger";
import { MarketModel } from "../model/markets";
import mongoose from "mongoose";
import { UserModel } from "../model/user";
import { stockbalanceModel } from "../model/stockbalance"


export async function splitOrder(req,res){
    const { success , data } = SplitSchema.safeParse(req.body)
    if(!success){
        return res.status(400).json({error: "Invalid input"})
    }
    let session
    try {
        const existingMarket = await MarketModel.findById(data.marketId)

        if(!existingMarket){
            throw new Error("MARKET_DOESNOT_EXIST")
        }

        if(existingMarket.resolution !== null){
            throw new Error("MARKET_RESOLVED")
        }

        let ledgerResults

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
            
            const debit = data.amount

            const result = await UserModel.updateOne(
                {_id: req.userId,
                    $expr:{
                        $gte:[
                            { $subtract: ["$usdbalance", "$lockedusdBalance"]},
                            debit
                        ]
                    }
                },
                {
                    $inc: { usdbalance: -data.amount}
                },
                { session, ordered: true}
            )

            if(result.modifiedCount !==1){
                throw new Error("INSUFFICIENT_BALANCE")
            }

            const eventId = new mongoose.Types.ObjectId()

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
                    userId: req.userId,
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

            const [ledger] = await transectionModel.create([{
                userId: req.userId,
                eventId: eventId,
                eventType: "SPLIT",
                usdDelta: -data.amount,
                noDelta: pair,
                yesDelta: pair,
                marketId: data.marketId
            }], { session, ordered: true})

            ledgerResults = {
                eventId,
                usdDelta: ledger.usdDelta,
                yesDelta: ledger.yesDelta,
                noDelta: ledger.noDelta
            }    
        })

        res.status(200).json({data: ledgerResults})
            
    } catch (error) {
        const errors = {
            MARKET_DOESNOT_EXIST:[404, "Market not found"],
            MARKET_RESOLVED:[400, "Cannot split in a resolved market"],
            USER_NOT_FOUND:[404, "User account not found"],
            INSUFFICIENT_BALANCE:[400, "Not enough available USD"]
        }

        if (errors[error.message]){
            const [status, message] = errors[error.message]

            return res.status(status).json({
                error: message
              })
        }

        console.error("splitOrder error:", error);

        return res.status(500).json({
        error: "Could not process splitOrder"
        })
    } finally {
        if(session){
            await session.endSession()
        }
        
    }
}