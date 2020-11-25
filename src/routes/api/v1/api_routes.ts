import express, {Request, Response, NextFunction} from "express";
import ensureAuthenticated from "../../../middleware/ensureAuthenticated";

// create router
const router = express.Router();

// set default response type to json
//@ts-ignore
router.use((req : Request, res : Response, next : NextFunction) => {
    res.type('json');
    return next();
})

// *****************************************
// LOGIN
// *****************************************
import loginRoutes from "./login";
router.use('/login', loginRoutes);

// everything from here on down needs to an authenticated user
router.use(ensureAuthenticated);

// *****************************************
// JWT
// *****************************************
import jwtRoutes from "./jwt";
router.use('/jwt', jwtRoutes);

// *****************************************
// PROMETHEUS
// *****************************************
import scrapeRoutes from "./prometheus-scape-endpoint";
router.use('/scrapedata', scrapeRoutes);

// *****************************************
// DATA
// *****************************************
import dataRoutes from "./data";
router.use('/data', dataRoutes);

// *****************************************
// HOUSES
// *****************************************
import houseRoutes from "./houses";
router.use("/houses", houseRoutes);

// *****************************************
// DEVICES
// *****************************************
import deviceRoutes from "./devices";
router.use("/devices", deviceRoutes);

// *****************************************
// SENSORS
// *****************************************
import sensorRoutes from "./sensors";
router.use("/sensors", sensorRoutes);

// *****************************************
// EXCEL
// *****************************************
import excelRoutes from "./excel";
router.use("/excel", excelRoutes);

export default router;
