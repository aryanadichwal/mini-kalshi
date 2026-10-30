import mongoose from "mongoose";


const { Schema } = mongoose

const marketsSchema = new Schema({
    creatorId: { type: Schema.Types.ObjectId , ref: "users", required: true},
    title: { type : String, required: true},
    totalIssued : { type: Number , default: 0},
    resolution: { type: String , enum : ["YES", "NO"], default: null}
})

marketsSchema.index(
    { creatorId: 1, title: 1 },
    { unique: true }
)
export const MarketModel = mongoose.model("markets", marketsSchema)