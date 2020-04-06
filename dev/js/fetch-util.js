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
const get = url => {
    return fetch(url, buildContext()).then(resp => resp.json());
}
const post = (url, body) => {
    return fetch(url, buildContext("post", body)).then(resp => resp.json());
}
const getSamples = (sensorId, samplesCount) => {
    return get(`/api/v1/data/samples/${sensorId}/${samplesCount}`).then(samples => {
        return Promise.resolve(samples.map(sample => {
            const s = {
                "id": sample.id,
                "value": sample.value,
                "dt_string": sample.dt_string,
                "dt": moment.utc(sample.dt).toDate()
            }
            return s;
        }))
    })
}
module.exports = {
    get,
    post,
    getSamples
}
