import mongoose from "mongoose";

const { Schema } = mongoose


const stockbalanceSchema = new Schema({
    userId: { type : Schema.Types.ObjectId, ref:"users", required: true},
    marketId: { type : Schema.Types.ObjectId, ref:"markets", required: true},
    type: { type : String, enum:["YES", "NO"], required: true}, 
    quantity: { type : Number,required: true, default: 0},
    locked: { type : Number, required: true, default: 0}
})

stockbalanceSchema.index(
    { userId: 1, marketId: 1, type: 1 },
    { unique: true }
)

export const stockbalanceModel = mongoose.model("stockbalances", stockbalanceSchema)