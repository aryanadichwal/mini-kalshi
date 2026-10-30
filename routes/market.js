import express from "express"
import Router from "express"
import { createMarket } from "../controller/market"
const app = express()
const marketRouter = Router()
import { auth } from "../middleware/auth"

marketRouter.post("/create-market",auth,createMarket)

export default marketRouter

