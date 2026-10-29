import express from "express"
import Router from "express"
import { signup, signin , onramp} from "../controller/auth"
const app = express()
const authRouter = Router()
import { auth } from "../middleware/auth"

authRouter.post("/signup",signup)
authRouter.post("/signin",signin)
authRouter.post("/onramp",auth, onramp )




export default authRouter

