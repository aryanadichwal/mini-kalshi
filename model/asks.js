import mongoose from "mongoose";

const { Schema } = mongoose

const asksSchema = new Schema({
    orderbookId: {type: Schema.Types.ObjectId, required: true, ref:"orderbooks"}, 
    price: { type: Number, required: true, },
    quantity: { type: Number, required: true, min: 1},
    userId: {type: Schema.Types.ObjectId, required: true, ref:"users"},
    stockType: { type : String , enum:["YES", "NO"], required: true}
})

export const askModel = mongoose.model("asks",asksSchema)