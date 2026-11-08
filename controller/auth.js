import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

import { SignupSchema, SigninSchema, OnrampSchema } from "../types/auth"
import { UserModel } from "../model/user"
import { transectionModel } from "../model/trancsectionLedger"
import mongoose from "mongoose"




export async function signup(req, res) {
    try{
        const parsed = SignupSchema.safeParse(req.body)
        if(!parsed.success){
            return res.status(411).json({message: "Incorrect inputs"})
        }
        const username = parsed.data.username
        const password = parsed.data.password

        const existUser = await UserModel.findOne({username})
        if (existUser){
            return res.status(412).json({message: "Username already exists"})
        }

        const hashed_pass = await bcrypt.hash(password, 5)
        const user = await UserModel.create({
            username,
            password: hashed_pass,
            usdbalance: 0
        })

        return res.status(200).json({id: user._id })
    } catch (e) {
        return res.status(400).json({ error: e.message })
    }
    
}

export async function signin(req, res) {
    try{
        const parsed = SigninSchema.safeParse(req.body)
        if(!parsed.success){
            return res.status(411).json({message:"Incorrect inputs"})
        }
        
        const {username , password} = parsed.data
        const user = await UserModel.findOne({username})
        if (!user) {
            return res.status(401).json({message:"Invalid credentials"})
        }

        const validPass = await bcrypt.compare(password , user.password)
        if(!validPass){
            return res.status(401).json({message:"Invalid credentials"})
        }
        
        const token = jwt.sign({ userId: user._id.toString()}, process.env.JWT_SECRET)
        return res.json({token})


    } catch (e) {
        res.status(500).json({error:e.message})
    }
}

export async function onramp(req, res) {
    let session 
    try{
        const {success, data} = OnrampSchema.safeParse(req.body)
        if(!success){
            return res.status(422).json({error:"Invalid amount"})
        }

        let ledgerResult 
        session = await mongoose.startSession()
        const amountCents = Math.round(data.amount * 100)
        
        await session.withTransaction(async()=>{
            const user = await UserModel.findByIdAndUpdate(
                req.userId,
                {$inc: {usdbalance: amountCents}},
                { new : true, session, ordered: true})
            
            if (!user) {
                throw new Error("NO_USER")
            }
    
            const eventId = new mongoose.Types.ObjectId()
    
            const [ledger] = await transectionModel.create([{
                userId: req.userId,
                eventId: eventId,
                eventType: "ONRAMP",
                usdDelta: +amountCents,
            }], { session, ordered: true})
            
            ledgerResult = {
                userId: ledger.userId,
                eventId: ledger.eventId,
                eventType: ledger.eventType,
                usdDelta: ledger.usdDelta,
            }
        })
        
        return res.status(200).json({data: ledgerResult})
    } catch (error) {
        const errors = {
            NO_USER:[404,"User not found"]
        }

        if (errors[error.message]){
            const [status, message] = errors[error.message]

            return res.status(status).json({
                error: message
              })
        }        
        console.error("onRamp error:", error);

        return res.status(500).json({
        error: "Could not process onRamp"
        })
    } finally {
        if(session){
            session.endSession()
        }
    }
}