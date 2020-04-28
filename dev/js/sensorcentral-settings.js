const storage = require("./storage-utils");
const uiutils = require("./ui-utils");
const formsutil = require("./forms-util");
const log = require("./logger");

module.exports = (document, elemRoot) => {
    elemRoot.html("");
    uiutils.appendTitleRow(elemRoot, "Settings");
    formsutil.appendSettings(undefined, data => {
        
    });
}
