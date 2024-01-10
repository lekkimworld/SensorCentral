import express, { Response } from "express";
import moment from "moment";
//@ts-ignore
import excel from "node-excel-export";
import constants, { ISO8601_DATETIME_FORMAT } from "../../../constants";
import { ensureScopeFactory } from "../../../middleware/ensureScope";
import { BackendIdentity, Dataset, HttpException } from "../../../types";
import {v4 as uuid} from "uuid";
//@ts-ignore
import { lookupService } from "../../../configure-services";
import {
    DataQueryGroupBy,
    DataQueryService,
    GroupedQueryDateFilterInput,
    GroupedQueryFormatInput,
    GroupedQueryGroupByInput,
    UngroupedQueryDateFilterInput,
    UngroupedQueryFormatInput,
} from "../../../services/dataquery/dataquery-service";
import { PowerpriceService } from "../../../services/powerprice-service";
import { StorageService } from "../../../services/storage-service";

const EXTENSION_EXCEL = "xlsx";

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
const specificationUngrouped : Record<string, ExcelColumnSpecification> = {
    COLUMN_DATETIME: {
        displayName: "Date/time",
        headerStyle: styles.headerDark,
        width: "26",
    },
    COLUMN_DATE: {
        displayName: "Date",
        headerStyle: styles.headerDark,
        width: "14",
    },
    COLUMN_TIME: {
        displayName: "Time",
        headerStyle: styles.headerDark,
        width: "10",
    },
    COLUMN_VALUE: {
        displayName: "Value",
        headerStyle: styles.headerDark,
        width: "20",
    },
};

type ExcelWorksheet = {
    name: string;
    specification: Record<string, ExcelColumnSpecification>,
    data: Array<any>
}
type ExcelWorkbook = {
    sheets: Array<ExcelWorksheet>
}

const createExcelWorkbook = (wb: ExcelWorkbook): Buffer => {
    console.log(wb);
    const report = excel.buildExport(wb.sheets);
    return report;
};

const sendDataAsFile = async (res: Response, buf: Buffer, type: OutputType, filename: string) => {
    let contentType;
    switch (type) {
        case "excel":
            contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            break;
    }
    
    // get storage service
    const storage = await lookupService(StorageService.NAME) as StorageService;

    // set in redis
    const downloadKey = uuid();
    storage.setTemporaryData(downloadKey, 120, buf);

    // return
    res.type("json");
    res.send({
        downloadKey,
        filename,
        contentType
    });
};

const fetchDataGrouped = async (
    start: Date,
    end: Date,
    sensorId: string,
    applyScaleFactor: boolean,
    user: BackendIdentity
): Promise<Dataset> => {
    // get service
    const srvc = (await lookupService(DataQueryService.NAME)) as DataQueryService;

    // create filter
    const filter = new GroupedQueryDateFilterInput();
    filter.start = start;
    filter.end = end;
    filter.sensorIds = [sensorId];

    // create grouping
    const grouping = new GroupedQueryGroupByInput();
    grouping.groupBy = DataQueryGroupBy.hour;

    const format = new GroupedQueryFormatInput();
    format.applyScaleFactor = applyScaleFactor;
    format.addMissingTimeSeries = false;
    format.ensureDefaults();

    // get data
    const dbdatas = await srvc.groupedQuery(filter, grouping, format, user);
    const dbdata = dbdatas[0];
    return dbdata;
};

const fetchDataUngrouped = async (
    start: Date,
    end: Date,
    sensorId: string,
    user: BackendIdentity
): Promise<Dataset> => {
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

const fetchDataPowerprices = async (date: string): Promise<Dataset> => {
    // get service
    const powerprices = (await lookupService(PowerpriceService.NAME)) as PowerpriceService;

    // define results
    const m = moment(date, "YYYY-MM-DD");
    const ds = await powerprices.getPowerdataForMoment(m, false);
    return ds;
};

type ExcelColumnSpecification = {
    displayName: string;
    headerStyle: any;
    width: string;
}

/**
 * 
 */
type ExportData = {
    extension: string;
    buffer: Buffer;
};

/**
 * The data type we can export into.
 */
type OutputType = "excel";
const isValidOutputType = (type: string): type is OutputType => {
    return ["excel"].includes(type);
};

/**
 * The type of sensor data export.
 */
type SensorDataExportType = "grouped" | "ungrouped";
const isValidSensorDataExportType = (type: string): type is SensorDataExportType => {
    return ["grouped", "ungrouped"].includes(type);
};
const buildExportSensorData = (type: SensorDataExportType, output: OutputType, datasets: Array<Dataset>): ExportData => {
    switch (output) {
        case "excel":
            return buildExportSensorDataExcel(type, datasets);
    }
};

const buildExportSensorDataExcel = (type: SensorDataExportType, datasets: Array<Dataset>): ExportData => {
    let buffer;
    switch (type) {
        case "grouped":
            buffer = buildExportSensorDataExcelGrouped(datasets);
            break;
        case "ungrouped":
            buffer = buildExportSensorDataExcelUngrouped(datasets);
            break;
    }
    return {
        extension: EXTENSION_EXCEL,
        buffer
    };
};

const buildExportSensorDataExcelUngrouped = (datasets: Array<Dataset>): Buffer => {
    // build buffer with a sheet per dataset
    const buffer = createExcelWorkbook({
        sheets: datasets.map(dataset => {
            return {
                name: dataset.name,
                specification: specificationUngrouped,
                data: dataset.data.map(de => {
                    const m = moment(de.x, ISO8601_DATETIME_FORMAT).utc(true).tz(constants.DEFAULTS.TIMEZONE);
                    return {
                        COLUMN_DATETIME: m.format("yyyy-MM-DD HH:mm:ss"),
                        COLUMN_DATE: m.format("yyyy-MM-DD"),
                        COLUMN_TIME: m.format("HH:mm:ss"),
                        COLUMN_VALUE: de.y,
                    };
                })
            } as ExcelWorksheet;
        })
    })
    return buffer;
}

const buildExportSensorDataExcelGrouped = (datasets: Array<Dataset>): Buffer => {
    // build column specification
    const specification: Record<string, ExcelColumnSpecification> = {
        COLUMN_GROUPING: {
            displayName: "Grouping",
            headerStyle: styles.headerDark,
            width: "26",
        },
    };
    datasets.forEach((dataset, idx) => {
        specification[`dataset${idx}`] = {
            displayName: dataset.name!,
            headerStyle: styles.headerDark,
            width: "20",
        };
    });

    // build buffer with a single sheet with a column per data set
    const buffer = createExcelWorkbook({
        sheets: [
            {
                name: "Data Export",
                specification,
                data: datasets[0].data.map((de, idx) => {
                    const result : Record<string, any> = {
                        COLUMN_GROUPING: de.x
                    }
                    datasets.forEach((dataset, dsIdx) => {
                        result[`dataset${dsIdx}`] = dataset.data[idx].y;
                    })
                    return result;
                }),
            },
        ],
    });

    // return
    return buffer;
};

const buildExportPowerprices = (output: OutputType, datasets: Array<Dataset>) : ExportData => {
    switch (output) {
        case "excel":
            return buildExportPowerpricesExcel(datasets);
    }
}

const buildExportPowerpricesExcel = (datasets: Array<Dataset>): ExportData => {
    // build specifications
    const specification : Record<string, ExcelColumnSpecification> = {
        COLUMN_GROUPING: {
            displayName: "Grouping",
            headerStyle: styles.headerDark,
            width: "26",
        }
    }
    datasets.forEach((dataset, dsIdx) => {
        specification[`dataset${dsIdx}`] = {
            displayName: `${dataset.name}`,
            headerStyle: styles.headerDark,
            width: "20"
        }
    })
    
    // build data
    const data = datasets[0].data.map((de, idx) => {
        const result : Record<string,any> = {
            COLUMN_GROUPING: de.x
        }
        datasets.forEach((ds, dsIdx) => {
            result[`dataset${dsIdx}`] = ds.data[idx].y
        })
        return result;
    });

    // build workbook
    const buffer = createExcelWorkbook({
        sheets: [
            {
                name: "Powerprices",
                specification,
                data
            }
        ]
    });

    // return
    return {
        extension: EXTENSION_EXCEL,
        buffer
    }
};

// ensure READ scope for GET requests
router.use(ensureScopeFactory(constants.JWT.SCOPE_READ));

router.post("/powerprices", async (req, res, next) => {
    const body = req.body;
    const output = body.output;
    if (!isValidOutputType(output)) return next(new HttpException(417, "Unexpected value for output"));

    // build data set
    const datasets: Array<Dataset> = await Promise.all(
        (body.dates as Array<string>).map((date) => {
            return fetchDataPowerprices(date);
        })
    );

    // export data
    const { extension, buffer } = buildExportPowerprices(output, datasets);

    // create filename
    const timestamp = moment().utc().format(ISO8601_DATETIME_FORMAT);
    const filename = `sensorcentral_export_powerprices_${timestamp}.${extension}`;

    // return
    sendDataAsFile(res, buffer, output, filename);
});

router.post("/sensordata", async (req, res, next) => {
    const body = req.body;
    const sensorIds = body.sensorIds as Array<string>;
    const strstart = body.start;
    const strend = body.end;
    const applyScaleFactor = body.applyScaleFactor;
    const type = body.type;
    if (!isValidSensorDataExportType(type)) return next(new HttpException(417, "Unexpexted value for type"));
    const output = body.output;
    if (!isValidOutputType(output)) return next(new HttpException(417, "Unexpected value for output"));

    if (
        !strstart.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z/) ||
        !strend.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z/)
    ) {
        return next(new HttpException(417, "Invalid start or end date/time (ISO8601)"));
    }

    const start = moment(strstart, ISO8601_DATETIME_FORMAT).utc(true).set("millisecond", 0);
    const end = moment(strend, ISO8601_DATETIME_FORMAT).utc(true).set("millisecond", 0);

    // build data set based on type
    const datasets: Array<Dataset> = await Promise.all(
        sensorIds.map((sensorId) => {
            switch (type) {
                case "ungrouped":
                    return fetchDataUngrouped(
                        start.toDate(),
                        end.toDate(),
                        sensorId,
                        res.locals.user as BackendIdentity
                    );
                case "grouped":
                    return fetchDataGrouped(
                        start.toDate(),
                        end.toDate(),
                        sensorId,
                        applyScaleFactor,
                        res.locals.user as BackendIdentity
                    );
            }
        })
    );

    const { extension, buffer } = buildExportSensorData(type, output, datasets);

    // create filename
    const timestamp = moment().utc().format(ISO8601_DATETIME_FORMAT);
    const filename = `sensorcentral_export_${timestamp}.${extension}`;

    // return
    sendDataAsFile(res, buffer, output, filename);
});

export default router;
