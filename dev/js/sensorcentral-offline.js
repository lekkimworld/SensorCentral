const uiutils = require("./ui-utils");
const log = require("./logger");

module.exports = (document, elemRoot) => {
    elemRoot.html(`<h1>Offline</h1>
    <p>
    The requested operation cannot be performed while offline.
    </p>`);
};