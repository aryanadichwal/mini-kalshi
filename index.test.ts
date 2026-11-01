import { test, expect, beforeAll, afterAll } from "bun:test";
import axios from "axios";
import { fr } from "zod/locales";
import "dotenv/config";
import mongoose from "mongoose";
import { MarketModel } from "./model/markets";
import { Bid } from "./model/bids";
import { Ask } from "./model/asks";
import { stockbalanceModel } from "./model/stockbalance";
import { UserModel } from "./model/user";


const BACKEND_URL = "http://localhost:3009/"
const USERNAME = `aryan-${Math.random()}`
const PASSWORD = `${Math.random()}`
const opts = { validateStatus: ()=> true}


async function gettoken(){
    await axios.post(`${BACKEND_URL}auth/signup`,{
        username: USERNAME,
        password: PASSWORD
    }, opts)

    const signin = await axios.post(`${BACKEND_URL}auth/signin`,{
        username: USERNAME,
        password: PASSWORD
    }, opts)

    return signin.data.token as string
}

test("short username returns 411", async ()=>{
    const res = await axios.post(`${BACKEND_URL}auth/signup`,{
        username: "a",
        password: "12341"
    }, opts)
    expect(res.status).toBe(411)
})

test("username taken", async ()=>{
    const first = await axios.post(`${BACKEND_URL}auth/signup`,{
        username: USERNAME,
        password: PASSWORD
    }, opts)
    expect(first.status).toBe(200)

    const second = await axios.post(`${BACKEND_URL}auth/signup`,{
        username: USERNAME,
        password: PASSWORD
    }, opts)
    expect(second.status).toBe(412)
})

test("If username and password not matched", async ()=>{
    const res = await axios.post(`${BACKEND_URL}auth/signin`,{
            username: `nobody-${Math.random()}`,
            password: `${Math.random()}` 
        }, opts)
        expect(res.status).toBe(401)
})

test("if the signin is succesfull", async()=>{
    const username = `username ${Math.random()}`
    await axios.post(`${BACKEND_URL}auth/signup`,{
        username: username,
        password: "correct-password"
    }, opts)

    const res = await axios.post(`${BACKEND_URL}auth/signin`,{
            username: username,
            password: `correct-password` 
    }, opts)
    expect(res.status).toBe(200)
    expect(res.data.token).toBeDefined()
    
})

test("on ramp amount invalid", async()=>{
    const res = await axios.post(`${BACKEND_URL}auth/onramp`,{
        amount: "string"
    }, opts)
    expect(res.status).toBe(401)
})

test("on ramp scuccesfull", async()=>{
   const token = await gettoken()

   const res = await axios.post(`${BACKEND_URL}auth/onramp`,{
        amount: 500
    }, { ...opts, headers: {token}})

    expect(res.status).toBe(200)
    expect(res.data.usdbalance).toBe(500)
})

test("Invalid title while creating market",async()=>{
    const token = await gettoken()
    
    const res = await axios.post(`${BACKEND_URL}market/create-market`,{
        title: 1
    }, { ...opts, headers: {token}})

    expect(res.status).toBe(400)
})

beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URL as string)
})

afterAll(async () => {
    await mongoose.disconnect()
})

async function createUser(amount = 100_000) {
    const username = `user-${Math.random()}`
    const password = `pass-${Math.random()}`

    const signup = await axios.post(`${BACKEND_URL}auth/signup`, {
        username,
        password
    }, opts)
    expect(signup.status).toBe(200)

    const signin = await axios.post(`${BACKEND_URL}auth/signin`, {
        username,
        password
    }, opts)
    expect(signin.status).toBe(200)

    const token = signin.data.token as string
    const onramp = await axios.post(`${BACKEND_URL}auth/onramp`, {
        amount
    }, { ...opts, headers: { token } })
    expect(onramp.status).toBe(200)

    return {
        id: signup.data.id,
        token
    }
}

async function createMarketFor(token: string, title = `market-${Math.random()}`) {
    const res = await axios.post(`${BACKEND_URL}market/create-market`, {
        title
    }, { ...opts, headers: { token } })
    expect(res.status).toBe(201)
    return res.data.market
}

async function placeOrder(token: string, body: {
    marketId: string
    type: "buy" | "sell"
    side: "YES" | "NO"
    price: number
    quantity: number
}) {
    return axios.post(`${BACKEND_URL}market/create-order`, body, {
        ...opts,
        headers: { token }
    })
}

async function mintContracts(params: {
    yesUser: { token: string }
    noUser: { token: string }
    marketId: string
    quantity: number
    yesPrice?: number
}) {
    const yesPrice = params.yesPrice ?? 50
    const yesRes = await placeOrder(params.yesUser.token, {
        marketId: params.marketId,
        type: "buy",
        side: "YES",
        price: yesPrice,
        quantity: params.quantity
    })
    const noRes = await placeOrder(params.noUser.token, {
        marketId: params.marketId,
        type: "buy",
        side: "NO",
        price: 100 - yesPrice,
        quantity: params.quantity
    })
    expect(yesRes.status).toBe(201)
    expect(noRes.status).toBe(201)
    expect(noRes.data.data.status).toBe("FILLED")
}

test("A user creating same market twice",async()=>{
    const token = await gettoken()
    const title = "Will tuporia regain his title"
    const first = await axios.post(`${BACKEND_URL}market/create-market`,{
        title: title
    }, { ...opts, headers: {token}})
    expect(first.status).toBe(201)

    const second = await axios.post(`${BACKEND_URL}market/create-market`,{
        title: title
    }, { ...opts, headers: {token}})

    expect(second.status).toBe(409)
})

test("Example A — BUY YES matches BUY NO", async () => {
    const userA = await createUser()
    const userB = await createUser()
    const market = await createMarketFor(userA.token)

    const orderA = await placeOrder(userA.token, {
        marketId: market.id,
        type: "buy",
        side: "YES",
        price: 65,
        quantity: 10
    })
    expect(orderA.status).toBe(201)

    const orderB = await placeOrder(userB.token, {
        marketId: market.id,
        type: "buy",
        side: "NO",
        price: 35,
        quantity: 10
    })
    expect(orderB.status).toBe(201)
    expect(orderB.data.data).toMatchObject({
        requestedQty: 10,
        filledQty: 10,
        remainingQty: 0,
        status: "FILLED"
    })

    const [bidA, bidB, marketAfter, yesA, noB] = await Promise.all([
        Bid.findById(orderA.data.data.orderId),
        Bid.findById(orderB.data.data.orderId),
        MarketModel.findById(market.id),
        stockbalanceModel.findOne({ userId: userA.id, marketId: market.id, type: "YES" }),
        stockbalanceModel.findOne({ userId: userB.id, marketId: market.id, type: "NO" })
    ])

    expect(bidA?.status).toBe("FILLED")
    expect(bidA?.remainingQty).toBe(0)
    expect(bidB?.status).toBe("FILLED")
    expect(bidB?.remainingQty).toBe(0)
    expect(marketAfter?.totalIssued).toBe(market.totalIssued + 10)
    expect(yesA?.quantity).toBe(10)
    expect(noB?.quantity).toBe(10)
})

test("Example B — BUY YES matches SELL YES", async () => {
    const userA = await createUser()
    const userB = await createUser()
    const minter = await createUser()
    const market = await createMarketFor(userA.token)

    await mintContracts({
        yesUser: userA,
        noUser: minter,
        marketId: market.id,
        quantity: 10
    })

    const marketAfterMint = await MarketModel.findById(market.id)
    const issuedAfterMint = marketAfterMint?.totalIssued
    const userABeforeSell = await UserModel.findById(userA.id)

    const sellA = await placeOrder(userA.token, {
        marketId: market.id,
        type: "sell",
        side: "YES",
        price: 70,
        quantity: 10
    })
    expect(sellA.status).toBe(201)

    const buyB = await placeOrder(userB.token, {
        marketId: market.id,
        type: "buy",
        side: "YES",
        price: 70,
        quantity: 10
    })
    expect(buyB.status).toBe(201)
    expect(buyB.data.data).toMatchObject({
        requestedQty: 10,
        filledQty: 10,
        remainingQty: 0,
        status: "FILLED"
    })

    const [askA, bidB, marketAfter, yesA, yesB, userAAfter] = await Promise.all([
        Ask.findById(sellA.data.data.orderId),
        Bid.findById(buyB.data.data.orderId),
        MarketModel.findById(market.id),
        stockbalanceModel.findOne({ userId: userA.id, marketId: market.id, type: "YES" }),
        stockbalanceModel.findOne({ userId: userB.id, marketId: market.id, type: "YES" }),
        UserModel.findById(userA.id)
    ])

    expect(askA?.status).toBe("FILLED")
    expect(askA?.remainingQty).toBe(0)
    expect(bidB?.status).toBe("FILLED")
    expect(bidB?.remainingQty).toBe(0)
    expect(marketAfter?.totalIssued).toBe(issuedAfterMint)
    expect(yesB?.quantity).toBe(10)
    expect(yesA?.quantity ?? 0).toBe(0)
    expect((userAAfter?.usdbalance ?? 0) - (userABeforeSell?.usdbalance ?? 0)).toBe(700)
})

test("Example C — Partial order matching", async () => {
    const userA = await createUser()
    const userB = await createUser()
    const minter = await createUser()
    const market = await createMarketFor(userA.token)

    await mintContracts({
        yesUser: userB,
        noUser: minter,
        marketId: market.id,
        quantity: 4
    })

    const userBBeforeSell = await UserModel.findById(userB.id)

    const buyA = await placeOrder(userA.token, {
        marketId: market.id,
        type: "buy",
        side: "YES",
        price: 80,
        quantity: 10
    })
    expect(buyA.status).toBe(201)

    const sellB = await placeOrder(userB.token, {
        marketId: market.id,
        type: "sell",
        side: "YES",
        price: 75,
        quantity: 4
    })
    expect(sellB.status).toBe(201)
    expect(sellB.data.data).toMatchObject({
        requestedQty: 4,
        filledQty: 4,
        remainingQty: 0,
        status: "FILLED"
    })

    const [bidA, askB, yesA, userBAfter] = await Promise.all([
        Bid.findById(buyA.data.data.orderId),
        Ask.findById(sellB.data.data.orderId),
        stockbalanceModel.findOne({ userId: userA.id, marketId: market.id, type: "YES" }),
        UserModel.findById(userB.id)
    ])

    expect(bidA?.quantity).toBe(10)
    expect((bidA?.quantity ?? 0) - (bidA?.remainingQty ?? 0)).toBe(4)
    expect(bidA?.remainingQty).toBe(6)
    expect(bidA?.status).toBe("PARTIALLY_FILLED")
    expect(askB?.status).toBe("FILLED")
    expect(yesA?.quantity).toBe(4)
    expect((userBAfter?.usdbalance ?? 0) - (userBBeforeSell?.usdbalance ?? 0)).toBe(320)
})