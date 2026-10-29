import "dotenv/config"
import express from "express"
import mongoose from "mongoose"
import authRouter from "./routes/auth"

const app = express()
app.use(express.json())

app.use("/auth",authRouter)



async function main(){
    await mongoose.connect(process.env.MONGO_URL)
    console.log("MongoDB connected")

    app.listen(process.env.PORT)
}


main().catch(console.error)

