const storage = require("./storage-utils");
const moment = require("moment");

const buildContext = (method) => {
    const ctx = {
        "method": method ? method.toUpperCase() : "GET",
        "headers": {
            "Authorization": `Bearer ${storage.getJWT()}`
        }
    }
    return ctx;
}
const doFetch = (url, ctx, type) => {
    $("#sensorcentral-spinner").removeClass("d-none");

    return fetch(url, ctx).then(resp => {
        $("#sensorcentral-spinner").addClass("d-none");
        if (type === "text") return resp.text();
        return resp.json();
    })
}
const doGet = (url, type = "json") => {
    return doFetch(url, buildContext());
}
const doPost = (url, body, type = "json") => {
    const ctx = buildContext("post");
    ctx.body = typeof body === "string" ? body : JSON.stringify(body);
    ctx.headers["Content-Type"] = "application/json";
    return doFetch(url, ctx, type);
}
const doPut = (url, body, type = "json") => {
    const ctx = buildContext("put");
    ctx.body = typeof body === "string" ? body : JSON.stringify(body);
    ctx.headers["Content-Type"] = "application/json";
    return doFetch(url, ctx, type);
}
const doDelete = (url, body, type = "json") => {
    const ctx = buildContext("delete");
    ctx.body = typeof body === "string" ? body : JSON.stringify(body);
    ctx.headers["Content-Type"] = "application/json";
    return doFetch(url, ctx, type);
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
const doGraphQL = query => {
    return doPost(`/graphql`, {
        "query": query
    }).then(payload => {
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
