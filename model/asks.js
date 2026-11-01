import mongoose from "mongoose";

const { Schema } = mongoose;

const asksSchema = new Schema(
  {
    orderbookId: {
      type: Schema.Types.ObjectId,
      ref: "orderbooks",
      required: true
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true
    },

    stockType: {
      type: String,
      enum: ["YES", "NO"],
      required: true
    },

    action: {
      type: String,
      enum: ["sell"],
      required: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    remainingQty: {
      type: Number,
      required: true,
      min: 0
    },

    status: {
      type: String,
      enum: ["OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED"],
      default: "OPEN"
    }
  },
  { timestamps: true }
);

export const Ask = mongoose.model("asks", asksSchema);