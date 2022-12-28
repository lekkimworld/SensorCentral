import {SensorDetails, createBuildUIFunctionWithQueryName} from "./sensordetails-base";

export default {
    actionManualSample: true, 
    "buildUI": createBuildUIFunctionWithQueryName("dataGroupedOffsetQuery")
} as SensorDetails;
