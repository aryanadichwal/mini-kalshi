import { password } from "bun"
import z from "zod"

export const SignupSchema = z.object({
    username: z.string().min(3).max(30),
    password: z.string().min(4).max(30)
})


export const SigninSchema = z.object({
    username: z.string().min(3).max(30),
    password: z.string().min(4).max(30)
})


export const OnrampSchema = z.object({
    amount: z.number().int().positive().max(1_000_000)
})