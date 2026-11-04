import mongoose from "mongoose";

const { Schema } = mongoose

const transactionLedgerSchema = new Schema({
    userId : { type: Schema.Types.ObjectId, required: true, ref:"users" },
    eventId : { type: Schema.Types.ObjectId, required: true,  },
    eventType : { type: String, enum:["ONRAMP", "SPLIT", "MERGE","CLAIM"], required: true },
    usdDelta : { type: Number, required:true},
    yesDelta: { type: Number, default: 0 },
    noDelta: { type: Number, default: 0 },
    marketId : { type: Schema.Types.ObjectId, ref:"markets"}
}, { timestamps: true} )

transactionLedgerSchema.index(
    {eventId:1, userId: 1},
    { unique : true})

export const transectionModel = mongoose.model("TransactionLedger", transactionLedgerSchema)