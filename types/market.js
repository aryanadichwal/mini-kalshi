import { password } from "bun"
import z from "zod"

export const CreateMarketSchema = z.object({
    title: z.string().trim().min(1),
})


