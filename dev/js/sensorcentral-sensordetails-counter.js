const {createBuildUIFunctionWithQueryName} = require("./sensorcentral-sensordetails-base");

module.exports = {
    actionManualSample: true, 
    "buildUI": createBuildUIFunctionWithQueryName("groupedQuery")
}
