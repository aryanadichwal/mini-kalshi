import jwt from "jsonwebtoken"

export async function auth(req,res,next){
    try{
        const token = req.headers.token
        const validToken =  jwt.verify(token, process.env.JWT_SECRET)
        req.userId = validToken.userId
        next()
    } catch (e) {
        res.status(401).json({
            error:e.message
        })
    }
}