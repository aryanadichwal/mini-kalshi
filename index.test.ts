import { test, expect } from "bun:test";
import axios from "axios";


const BACKEND_URL = "http://localhost:3009/"
const USERNAME = `aryan-${Math.random()}`
const PASSWORD = `${Math.random()}`
const opts = { validateStatus: ()=> true}

test("short username returns 411", async ()=>{
    const res = await axios.post(`${BACKEND_URL}auth/signup`,{
        username: "a",
        password: "12341"
    }, opts)
    expect(res.status).toBe(411)
})

test("If username and password are used again in signup  it should return 412", async ()=>{
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