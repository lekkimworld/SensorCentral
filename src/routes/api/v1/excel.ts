import * as express from "express";
import Moment from "moment";
import moment = require("moment");
import * as prometheus from "../../../prometheus-export";
import { HttpException } from "../../../types";
import { ensureReadScopeWhenGetRequest } from "../../../middleware/ensureScope";
import {ISO8601_DATETIME_FORMAT} from "../../../constants"

const router = express.Router();

const exportPrometheusData = (
    res: express.Response,
    sensorLabel: string,
    start: Moment.Moment,
    end: Moment.Moment,
    step?: string
) => {
    prometheus
        .fetchData({
            query: `sensor{sensorLabel="${sensorLabel}"}`,
            start: start,
            end: end,
            step: step,
        })
        .then((dataset: Array<prometheus.ExportedSensorValue>) => {
            const buf = prometheus.createExcelWorkbook(dataset);
            const timestamp = moment().utc().format(ISO8601_DATETIME_FORMAT);
            res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.set(
                "Content-Disposition",
                `attachment; filename="sensorcentral_export_${sensorLabel}_${timestamp}.xlsx"`
            );
            res.send(buf).end();
        });
};

// ensure READ scope for GET requests
router.use(ensureReadScopeWhenGetRequest);

router.get("/range/custom/:sensorLabel/:start/:end/:step?", (req, res, next) => {
    const sensorLabel = req.params.sensorLabel;
    const strstart = req.params.start;
    const strend = req.params.end;
    if (
        !strstart.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z/) ||
        !strend.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z/)
    ) {
        return next(new HttpException(417, "Invalid start or end date/time (ISO8601)"));
    }

    const start = moment(strstart, "yyyy-MM-DD{T}HH:mm:ss.SSS{Z}").utc(true).set("millisecond", 0);
    const end = moment(strend, "yyyy-MM-DD{T}HH:mm:ss.SSS{Z}").utc(true).set("millisecond", 0);
    const step = req.params.step && req.params.step.match(/\d{1,}[mh]/) ? req.params.step : "60m";

    exportPrometheusData(res, sensorLabel, start, end, step);
});

router.get("/range/standard/:sensorLabel/:period/:step?", (req, res, next) => {
    // get sensor label
    const sensorLabel = req.params.sensorLabel;
    const period = req.params.period;
    let start: Moment.Moment;
    let end: Moment.Moment;
    let step: string | undefined = req.params.step;
    if (period === "last24hrs") {
        start = moment().set("minute", 0).set("second", 0).set("millisecond", 0).add(-24, "hour").utc();
        end = moment().set("minute", 0).set("second", 0).set("millisecond", 0).utc();
    } else if (period === "lastweek") {
        start = moment().set("minute", 0).set("second", 0).set("millisecond", 0).add(-1, "week").utc();
        end = moment().set("minute", 0).set("second", 0).set("millisecond", 0).utc();
    } else {
        return next(new HttpException(417, "Unknown period supplied"));
    }

    exportPrometheusData(res, sensorLabel, start, end, step);
});

export default router;
