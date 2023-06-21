import express, { Response } from "express";
import moment from "moment";
//@ts-ignore
import excel from "node-excel-export";
import constants, { ISO8601_DATETIME_FORMAT } from "../../../constants";
import { ensureReadScopeWhenGetRequest } from "../../../middleware/ensureScope";
import { BackendIdentity, HttpException } from "../../../types";
//@ts-ignore
import { lookupService } from "../../../configure-services";
import { DataQueryGroupBy, Dataset, DataQueryService, GroupedQueryDateFilterInput, GroupedQueryFormatInput, GroupedQueryGroupByInput, UngroupedQueryDateFilterInput, UngroupedQueryFormatInput } from "../../../services/dataquery-service";

const router = express.Router();

// styles
const styles = {
    headerDark: {
        font: {
            color: {
                rgb: "000000",
            },
            sz: 14,
            bold: true,
        },
    },
};

// specify the export structures
const specificationUngrouped = {
    datetime: {
        displayName: "Date/time",
        headerStyle: styles.headerDark,
        width: "26",
    },
    date: {
        displayName: "Date",
        headerStyle: styles.headerDark,
        width: "14",
    },
    time: {
        displayName: "Time",
        headerStyle: styles.headerDark,
        width: "10",
    },
    value: {
        displayName: "Value",
        headerStyle: styles.headerDark,
        width: "20",
    },
};
const specificationGrouped = {
    grouping: {
        displayName: "Grouping",
        headerStyle: styles.headerDark,
        width: "26",
    },
    value: {
        displayName: "Value",
        headerStyle: styles.headerDark,
        width: "20",
    },
};

const createExcelWorkbook = (specification: any, data: Array<any>): Buffer => {
    const report = excel.buildExport([
        {
            name: "Export Data",
            specification,
            data
        },
    ]);
    return report;
};

const sendExcelWorkbook = (res: Response, buf: Buffer, filename: string) => {
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf).end();
};

const fetchDataGrouped = async (start: Date, end: Date, sensorId: string, user: BackendIdentity): Promise<Dataset> => {
    // get service
    const srvc = await lookupService(DataQueryService.NAME) as DataQueryService;

    // create filter
    const filter = new GroupedQueryDateFilterInput();
    filter.start = start;
    filter.end = end;
    filter.sensorIds = [sensorId];
    
    // create grouping
    const grouping = new GroupedQueryGroupByInput();
    grouping.groupBy = DataQueryGroupBy.hour;
    
    const format = new GroupedQueryFormatInput();
    format.applyScaleFactor = false;
    format.addMissingTimeSeries = false;
    format.ensureDefaults();
    
    // get data
    const dbdatas = await srvc.groupedQuery(filter, grouping, format, user);
    const dbdata = dbdatas[0];
    return dbdata;
}

const fetchDataUngrouped = async (start: Date, end: Date, sensorId: string, user: BackendIdentity): Promise<Dataset> => {
    // get service
    const srvc = (await lookupService(DataQueryService.NAME)) as DataQueryService;

    // create filter
    const filter = new UngroupedQueryDateFilterInput();
    filter.start = start;
    filter.end = end;
    filter.sensorIds = [sensorId];
    
    const format = new UngroupedQueryFormatInput();
    format.applyScaleFactor = false;
    format.ensureDefaults();

    // get data
    const dbdatas = await srvc.ungroupedQuery(filter, format, user);
    const dbdata = dbdatas[0];
    return dbdata;
};

const exportDataGrouped = async (
    res: express.Response,
    sensorId: string,
    start: Date,
    end: Date
) => {
    // create filename
    const timestamp = moment().utc().format(ISO8601_DATETIME_FORMAT);
    const filename = `sensorcentral_grouped_export_${sensorId}_${timestamp}.xlsx`;
    
    // get the data
    const dataset = await fetchDataGrouped(
        start,
        end,
        sensorId,
        res.locals.user as BackendIdentity
    );

    // create workbook
    const buf = createExcelWorkbook(specificationGrouped, dataset.data.map(de => {
        return {
            "grouping": de.x,
            "value": de.y
        }
    }));

    // return workbook
    sendExcelWorkbook(res, buf, filename);
};

const exportDataUngrouped = async (res: express.Response, sensorId: string, start: Date, end: Date) => {
    // create filename
    const timestamp = moment().utc().format(ISO8601_DATETIME_FORMAT);
    const filename = `sensorcentral_ungrouped_export_${sensorId}_${timestamp}.xlsx`;

    // get the data
    const dataset = await fetchDataUngrouped(start, end, sensorId, res.locals.user as BackendIdentity);

    // create workbook
    const buf = createExcelWorkbook(specificationUngrouped, dataset.data.map(de => {
        const m = moment(de.x, ISO8601_DATETIME_FORMAT).utc(true).tz(constants.DEFAULTS.TIMEZONE);
        return {
            datetime: m.format("yyyy-MM-DD HH:mm:ss"),
            date: m.format("yyyy-MM-DD"),
            time: m.format("HH:mm:ss"),
            value: de.y,
        };
    }));

    // return workbook
    sendExcelWorkbook(res, buf, filename);
};

// ensure READ scope for GET requests
router.use(ensureReadScopeWhenGetRequest);

router.get("/grouped/range/:sensorId/:start/:end", (req, res, next) => {
    const sensorId = req.params.sensorId;
    const strstart = req.params.start;
    const strend = req.params.end;
    if (
        !strstart.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z/) ||
        !strend.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z/)
    ) {
        return next(new HttpException(417, "Invalid start or end date/time (ISO8601)"));
    }

    const start = moment(strstart, ISO8601_DATETIME_FORMAT).utc(true).set("millisecond", 0);
    const end = moment(strend, ISO8601_DATETIME_FORMAT).utc(true).set("millisecond", 0);
    
    exportDataGrouped(res, sensorId, start.toDate(), end.toDate());
});

router.get("/ungrouped/range/:sensorId/:start/:end", (req, res, next) => {
    const sensorId = req.params.sensorId;
    const strstart = req.params.start;
    const strend = req.params.end;
    if (
        !strstart.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z/) ||
        !strend.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z/)
    ) {
        return next(new HttpException(417, "Invalid start or end date/time (ISO8601)"));
    }

    const start = moment(strstart, ISO8601_DATETIME_FORMAT).utc(true).set("millisecond", 0);
    const end = moment(strend, ISO8601_DATETIME_FORMAT).utc(true).set("millisecond", 0);

    exportDataUngrouped(res, sensorId, start.toDate(), end.toDate());
});

export default router;
