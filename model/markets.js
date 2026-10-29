import mongoose from "mongoose";


const { Schema } = mongoose

const marketsSchema = new Schema({
    creatorId: { type: Schema.Types.ObjectId , ref: "users", required: true},
    title: { type : String, required: true},
    totalIssued : { type: Number , default: 0},
    resoltion: { type: String , enum : ["yes", "no"], default: null}
})

export const MarketsModel = mongoose.model("markets", marketsSchema)