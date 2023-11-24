import * as storage from "./storage-utils";

type MethodType = "GET"|"POST"|"PUT"|"DELETE";

type FetchContext = {
    method: MethodType,
    headers: Record<string,string>,
    body?: FetchBodyType;
}

export type FetchBodyType = string | any[] | Record<string,any>;

export type FetchOptions = {
    noSpinner?: boolean;
}

const buildContext = (method: MethodType, headers?: Record<string,string>, body?: FetchBodyType) : FetchContext => {
    const ctx : FetchContext = {
        method,
        headers: {}
    }
    
    if (headers && headers["accept"]) {
        ctx.headers["accept"] = headers.accept;
    }
    if (headers && headers["type"]) {
        ctx.headers["content-type"] = headers["type"];
    } else if (headers && headers["content-type"]) {
        ctx.headers["content-type"] = headers["content-type"];
    } else {
        ctx.headers["content-type"] = "application/json";
    }
    if (headers && headers["authorization"]) {
        ctx.headers["authorization"] = headers["authorization"];
    } else if (storage.isLoggedIn()) {
        ctx.headers["authorization"] = `Bearer ${storage.getJWT()}`;
    }
    if (body && ["POST","PUT"].includes(method)) {
        if (typeof body === "string") {
            ctx.body = body;
        } else {
            ctx.body = JSON.stringify(body);
        }
    }
    return ctx;
}

const doFetch = async (url: string, ctx: FetchContext, options?: FetchOptions) : Promise<any> => {
    const noSpinner = options && options.noSpinner;
    if (!noSpinner) $("#sensorcentral-spinner").removeClass("d-none");
    
    const fetchArgs = {
        method: ctx.method,
        headers: ctx.headers,
    } as any;
    if (ctx.body) fetchArgs.body = ctx.body;
    const resp = await fetch(url, fetchArgs);
    if (Math.floor(resp.status / 100) === 2) {
        // success
        if (!noSpinner) $("#sensorcentral-spinner").addClass("d-none");
        const headers = resp.headers;
        if (headers.has("content-type") && headers.get("content-type")!.indexOf("application/octet-stream") === 0) return resp.blob();
        if (headers.has("content-disposition") && headers.get("content-disposition")!.indexOf("attachment") === 0) return resp.blob();
        if (ctx.headers["content-type"] === "text/plain" || ctx.headers["content-type"] === "text") return resp.text();
        return resp.json();
    } else {
        throw new Error(`Received non-200 status code <${resp.status}>`);
    }
}
export const get = async (url: string, options?: FetchOptions) => {
    return doFetch(url, buildContext("GET"), options);
}
export const post = async (url: string, body: FetchBodyType, options?: FetchOptions) => {
    return doFetch(url, buildContext("POST", undefined, body));
}
export const put = async (url:string, body: FetchBodyType) => {
    return doFetch(url, buildContext("PUT", undefined, body));
}
export const del = async (url:string, body: FetchBodyType) => {
    return doFetch(url, buildContext("DELETE", undefined, body));
}
export const graphql = async (query: string, options?: FetchOptions) : Promise<any> => {
    const payload = await post(`/graphql`, {
        "query": query
    }, options);
    if (payload.hasOwnProperty("error")) throw new Error(payload.error.errors[0].message);
    if (payload.hasOwnProperty("errors")) throw new Error(payload.errors[0].message);
    return payload.data;
}
