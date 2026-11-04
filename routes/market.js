import express from "express"
import Router from "express"
import { createMarket , createOrder, } from "../controller/market"
import { splitOrder } from "../controller/split"

const app = express()

const marketRouter = Router()

import { auth } from "../middleware/auth"

marketRouter.post("/create-market",auth,createMarket)

marketRouter.post("/create-order",auth,createOrder)

marketRouter.post("/split-order",auth, splitOrder)

export default marketRouter

