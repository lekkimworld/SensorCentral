const storage = require("./storage-utils");

const buildContext = (method) => {
    const ctx = {
        "method": method ? method.toUpperCase() : "GET",
        "headers": {
            "Authorization": `Bearer ${storage.getJWT()}`
        }
    }
    return ctx;
}
module.exports = {
    get: url => {
        return fetch(url, buildContext()).then(resp => resp.json());
    },
    post: (url, body) => {
        return fetch(url, buildContext("post", body)).then(resp => resp.json());
    }
}
