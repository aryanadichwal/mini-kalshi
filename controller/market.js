import { CreateMarketSchema } from "../types/market"
import { MarketModel } from "../model/markets"
import { orderbookModel } from "../model/orderbook"
import mongoose from "mongoose"


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