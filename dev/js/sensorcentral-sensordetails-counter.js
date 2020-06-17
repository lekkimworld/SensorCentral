const {createBuildUIFunctionWithQueryName} = require("./sensorcentral-sensordetails-base");

module.exports = {
    actionManualSample: false, 
    "buildUI": createBuildUIFunctionWithQueryName("counterGroupedQuery")
}
