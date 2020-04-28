import { Request, Response, NextFunction } from "express";
import { HttpException } from "../types";

class ErrorObject {
    error = true;
    readonly message : string;

    constructor(msg : string, err? : Error) {
        if (err) {
            this.message = `${msg} (${err.message})`;
        } else {
            this.message = msg;
        }
    }
}

//@ts-ignore
export default (err : Error, req : Request, res : Response, next : NextFunction) => {
    if (err instanceof HttpException) {
        const ex = err as HttpException;
        return res.type(ex.type).status(ex.statusCode).send(new ErrorObject(ex.message, ex.error));
    }
    next();
}
