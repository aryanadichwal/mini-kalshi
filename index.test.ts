import { test, expect } from "bun:test";
import axios from "axios";
import { fr } from "zod/locales";


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
    expect(res.data.balance).toBe(500)
})

test("Invalid title while creating market",async()=>{
    const token = await gettoken()
    
    const res = await axios.post(`${BACKEND_URL}market/create-market`,{
        title: 1
    }, { ...opts, headers: {token}})

    expect(res.status).toBe(400)
})

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