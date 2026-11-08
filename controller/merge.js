import { transectionModel } from "../model/trancsectionLedger";
import { MarketModel } from "../model/markets";
import mongoose from "mongoose";
import { UserModel } from "../model/user";
import { stockbalanceModel } from "../model/stockbalance"
import { MergeSchema } from "../types/market";


export  async function mergeOrder(req,res) {
    const {success , data } = MergeSchema.safeParse(req.body)
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

            const YesContracts = await stockbalanceModel.findOne({
                userId: req.userId,
                marketId: data.marketId,
                type: "YES"
            }).session(session)
            
            if(!YesContracts){
                throw new Error("NO_YES_CONTRACTS")
            }

            const availableYesContracts = YesContracts.quantity - YesContracts.locked

            if(availableYesContracts < data.pairQuanity){
                throw new Error("INSUFFICIENT_YES_CONTRACTS")
            }

            const NoContracts = await stockbalanceModel.findOne({
                userId: req.userId,
                marketId: data.marketId,
                type: "NO"
            }).session(session)

            if(!NoContracts){
                throw new Error("NO_NO_CONTRACTS")
            }

            const availableNoContracts = NoContracts.quantity - NoContracts.locked

            
            if(availableNoContracts < data.pairQuanity){
                throw new Error("INSUFFICIENT_NO_CONTRACTS")
            }

            const eventId = new mongoose.Types.ObjectId()

            const pairCount  = data.pairQuanity

            await stockbalanceModel.findOneAndUpdate(
                {
                    userId: req.userId,
                    marketId: data.marketId,
                    type: "YES"
                },
                {
                $inc:{
                    quantity: -pairCount 
                }
            }, { session, ordered: true})

            await stockbalanceModel.findOneAndUpdate(
                {
                    userId: req.userId,
                    marketId: data.marketId,
                    type: "NO"
                },
                {
                $inc:{
                    quantity: -pairCount 
                }
            }, { session, ordered: true})

            const usdCents  = data.pairQuanity * 100

            const existingUser = await UserModel.findById(req.userId).session(session)

            if(!existingUser){
                throw new Error("USER_NOT_FOUND")

            }
            await UserModel.findOneAndUpdate(
                {
                    _id:req.userId
                },
                {
                $inc:{
                    usdbalance: +usdCents 
                }
            },{ session, ordered: true})


            await MarketModel.findOneAndUpdate(
                {
                    _id:data.marketId
                },
                {
                $inc:{
                    totalIssued: -pairCount 
                }
            },{ session, ordered: true})
            
            const [ledger] = await transectionModel.create([{
                userId: req.userId,
                eventId:eventId,
                eventType:"MERGE",
                usdDelta: +usdCents ,
                yesDelta: -pairCount ,
                noDelta: -pairCount ,
                marketId: data.marketId
            }],{ session, ordered: true})

            ledgerResults = {
                userId: ledger.userId,
                eventId:ledger.eventId,
                eventType:ledger.eventType,
                usdDelta: ledger.usdDelta,
                yesDelta: ledger.yesDelta,
                noDelta: ledger.noDelta,
                marketId: ledger.marketId
            }
        })

        res.status(200).json({data: ledgerResults})
    } catch (error) {
        const errors = {
            MARKET_DOESNOT_EXIST:[404, "Market not found"],
            MARKET_RESOLVED:[400, "Cannot merge in a resolved market"],
            USER_NOT_FOUND:[404, "User account not found"],
            INSUFFICIENT_YES_CONTRACTS:[400, "Not enough YES Contracts"],
            INSUFFICIENT_NO_CONTRACTS:[400, "Not enough NO Contracts"],
            NO_YES_CONTRACTS:[400, "Not enough YES Contracts"],
            NO_NO_CONTRACTS:[400,"Not enough NO Contracts"]
        }

        if (errors[error.message]){
            const [status, message] = errors[error.message]

            return res.status(status).json({
                error: message
              })
        }

        console.error("mergeOrder error:", error);

        return res.status(500).json({
        error: "Could not process mergeOrder"
        })
    } finally {
        if(session){
            await session.endSession()
        }
    }
}