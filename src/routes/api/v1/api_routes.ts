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
// DATA
// *****************************************
import dataRoutes from "./data";
router.use('/data', dataRoutes);

// *****************************************
// EXCEL
// *****************************************
import exportRoutes from "./export";
router.use("/export", exportRoutes);

// *****************************************
// WATCHDOG
// *****************************************
import watchdogRoutes from "./watchdog";
router.use("/watchdog", watchdogRoutes);

export default router;
