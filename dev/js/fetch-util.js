const storage = require("./storage-utils");
const moment = require("moment");
const $ = require("jquery");

const buildContext = (options = {}) => {
    const ctx = Object.assign({}, options);
    if (!ctx.hasOwnProperty("method")) ctx.method = "GET";
    if (!ctx.hasOwnProperty("headers")) ctx.headers = {};
    if (!ctx.hasOwnProperty("type")) {
        ctx.headers["content-type"] = "application/json";
    } else {
        ctx.headers["content-type"] = ctx.type;
        delete ctx.type;
    }
    if (!ctx.headers.hasOwnProperty("authorization")) ctx.headers.authorization = `Bearer ${storage.getJWT()}`;

    return ctx;
}
const doFetch = (url, ctx) => {
    const noSpinner = Object.prototype.hasOwnProperty.call(ctx, "noSpinner");
    if (!noSpinner) $("#sensorcentral-spinner").removeClass("d-none");

    return fetch(url, ctx).then(resp => {
        if (!noSpinner) $("#sensorcentral-spinner").addClass("d-none");
        const headers = resp.headers || {};
        if (headers.get("content-type").indexOf("application/octet-stream") === 0) return resp.blob();
        if (headers.get("content-disposition") && headers.get("content-disposition").indexOf("attachment") === 0) return resp.blob();
        if (ctx["content-type"] === "text/plain" || ctx["content-type"] === "text") return resp.text();
        return resp.json();
    })
}
const doGet = (url, options = {}) => {
    return doFetch(url, buildContext(options));
}
const doPost = (url, body, options = {}) => {
    const ctx = buildContext(Object.assign({}, { "method": "POST" }, options));
    ctx.body = typeof body === "string" ? body : JSON.stringify(body);
    return doFetch(url, ctx);
}
const doPut = (url, body, options = {}) => {
    const ctx = buildContext(Object.assign({}, { "method": "PUT" }, options));
    ctx.body = typeof body === "string" ? body : JSON.stringify(body);
    return doFetch(url, ctx, type);
}
const doDelete = (url, body, options = {}) => {
    const ctx = buildContext(Object.assign({}, { "method": "DELETE" }, options));
    ctx.body = typeof body === "string" ? body : JSON.stringify(body);
    return doFetch(url, ctx);
}
const getSamples = (sensorId, samplesCount) => {
    return doGet(`/api/v1/data/samples/${sensorId}/${samplesCount}`).then(samples => {
        return Promise.resolve(samples.map(sample => {
            const s = {
                "id": sample.id,
                "value": sample.value,
                "dt": moment.utc(sample.dt).toDate()
            }
            return s;
        }))
    })
}
const doGraphQL = (query, ctx = {}) => {
    return doPost(`/graphql`, {
        "query": query
    }, ctx).then(payload => {
        if (payload.hasOwnProperty("error")) return Promise.reject(Error(payload.error.errors[0].message));
        if (payload.hasOwnProperty("errors")) return Promise.reject(Error(payload.errors[0].message));
        return Promise.resolve(payload.data);
    });
}

module.exports = {
    "get": doGet,
    "post": doPost,
    "delete": doDelete,
    "put": doPut,
    "graphql": doGraphQL,
    getSamples
}