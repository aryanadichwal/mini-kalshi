
import z from "zod"

export const CreateMarketSchema = z.object({
    title: z.string().trim().min(1),
})

export const CreateOrderSchema = z.object({
    marketId: z.string().regex(/^[a-f\d]{24}$/i),
    price: z.number().int().min(1).max(99),
    quantity: z.number().int().positive().min(1),
    type: z.enum(["buy", "sell"]),
    side: z.enum(["YES", "NO"])
})

export const SplitSchema = z.object({
    marketId: z.string().regex(/^[a-f\d]{24}$/i),
    amount: z.number().int().min(1),   
})