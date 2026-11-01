import mongoose from "mongoose";

const { Schema } = mongoose

const orderbookSchema = new Schema({
    marketId : {type: Schema.Types.ObjectId , ref: "markets" , required: true},
    type : { type : String , enum:["YES", "NO"], required: true}
})

orderbookSchema.index(
    { marketId: 1, type: 1 },
    { unique: true }
)

export const orderbookModel = mongoose.model("orderbooks", orderbookSchema)