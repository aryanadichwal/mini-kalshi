import mongoose from "mongoose";

const { Schema } = mongoose


const stockbalanceSchema = new Schema({
    userId: { type : Schema.Types.ObjectId, ref:"users", required: true},
    marketId: { type : Schema.Types.ObjectId, ref:"markets", required: true},
    type: { type : String, enum:["YES", "NO"], required: true}, 
    quantity: { type : Number, min: 1,required: true},
    lockedQuantity: { type : Number, required: true}
})


export const stockbalanceModel = mongoose.model("stockbalances", stockbalanceSchema)