import { Request, Response, NextFunction } from "express";
import { HttpException, ErrorObject } from "../types";

//@ts-ignore
export default (err : Error, req : Request, res : Response, next : NextFunction) => {
    if (err instanceof HttpException) {
        const ex = err as HttpException;
        return res.type(ex.type).status(ex.statusCode).send(new ErrorObject(ex.message, ex.error));
    }
    next();
}