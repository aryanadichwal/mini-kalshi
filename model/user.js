import mongoose from "mongoose";

const { Schema } = mongoose

export const User = new Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
})

export const UserModel = mongoose.model("users", User )