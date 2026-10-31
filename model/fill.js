import mongoose from "mongoose";

const { Schema } = mongoose;

const fillSchema = new Schema(
  {
    tradeId: {type: Schema.Types.ObjectId,required: true,index: true},
    orderId: {type: Schema.Types.ObjectId,ref: "orders",required: true},
    orderbookId: {type: Schema.Types.ObjectId,ref: "orderbooks",required: true},
    userId: {type: Schema.Types.ObjectId,ref: "users",required: true},
    price: {type: Number,required: true, min: 0},
    quantity: { type: Number, required: true, min: 1},
    type: {  type: String, enum: ["buy", "sell"], required: true},
    isMaker: { type: Boolean, required: true}
  },
  { timestamps: true }
);

fillSchema.index({ userId: 1, createdAt: -1 });

export const fillModel = mongoose.model("fills", fillSchema);