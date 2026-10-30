import "dotenv/config"
import express from "express"
import mongoose from "mongoose"
import authRouter from "./routes/auth"
import marketRouter from "./routes/market"

const app = express()
app.use(express.json())

app.use("/auth",authRouter)
app.use("/market",marketRouter)



async function main(){
    await mongoose.connect(process.env.MONGO_URL)
    console.log("MongoDB connected")

    await app.listen(process.env.PORT)
    console.log(`Running on port ${process.env.PORT}`)
}


main().catch(console.error)

