import mongoose from "mongoose";

const { Schema } = mongoose

const createOrderSchema = new Schema({
    marketId: {type: Schema.Types.ObjectId, required: true, ref:"markets"}, 
    price: { type: Number, min: 1 , max: 99 , required: true, validate: Number.isInteger},
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger},
    userId: {type: Schema.Types.ObjectId, required: true, ref:"users"},
    stockType: { type : String , enum:["YES", "NO"], required: true},
    type: { type : String , enum:["buy", "sell"], required: true }
})

export const createOrderModel = mongoose.model("createOrder",createOrderSchema)