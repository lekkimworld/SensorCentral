import { Logger } from "../logger";
import { ObjectType, Field, InputType, ID } from "type-graphql";
import { IsEnum, Matches } from "class-validator";
import constants, { ISO8601_DATETIME_FORMAT } from "../constants";
import * as types from "../types";
import { QueryResult } from "pg";
import moment from "moment";
import { Sensor } from "../resolvers/sensor";
import { StorageService } from "./storage-service";

export enum DataQueryGroupBy {
    year = "YYYY",
    month = "YYYY-MM",
    week = "YYYY W",
    day = "YYYY-MM-DD",
    hour = "YYYY-MM-DD HH24",
}

export enum CounterQueryAdjustBy {
    year = "year",
    month = "month",
    week = "week",
    day = "day",
}

export interface IEnsureDefaults {
    ensureDefaults(): void;
}

@ObjectType()
export class GraphQLDataset implements Dataset {
    constructor(id: string, name: string | undefined) {
        this.id = id;
        this.name = name;
        this.data = [];
        this.fromCache = false;
    }

    @Field(() => ID)
    id: string;

    @Field(() => String, { nullable: true })
    name: string | undefined;

    @Field(() => Boolean, { nullable: false })
    fromCache: boolean;

    @Field(() => [GraphQLDataElement])
    data: DataElement[];
}

@InputType()
export class PowerConsumptionQueryFilterInput {
    @Field({ nullable: false, description: "The sensor ID of the power meter" })
    id: string;

    @Field({ nullable: false, description: "Start date/time in ISO8601 format" })
    start: Date;

    @Field({ nullable: false, description: "End date/time in ISO8601 format" })
    end: Date;
}

@InputType()
export class PowerConsumptionQueryFormatInput implements IEnsureDefaults {
    @Field({
        nullable: true,
        description: "The timezone for the date/time information in the x-field of the dataset",
        defaultValue: constants.DEFAULTS.TIMEZONE,
    })
    timezone: string;

    ensureDefaults() {
        if (!Object.prototype.hasOwnProperty.call(this, "timezone")) {
            this.timezone = constants.DEFAULTS.TIMEZONE;
        }
    }
}

@InputType()
export class PowerDataQueryFilterInput {
    @Field({ nullable: false, description: "The sensor ID of the power meter" })
    id: string;

    @Field(() => types.PowerPhase, { nullable: false, description: "The phase you are querying for" })
    @IsEnum(types.PowerPhase)
    phase: types.PowerPhase;

    @Field(() => types.PowerType, { nullable: false, description: "The type of data you are querying for" })
    @IsEnum(types.PowerType)
    type: types.PowerType;

    @Field({ nullable: false, description: "Start date/time in ISO8601 format" })
    start: Date;

    @Field({ nullable: false, description: "End date/time in ISO8601 format" })
    end: Date;
}

@InputType()
export class PowerDataQueryFormatInput implements IEnsureDefaults {
    @Field({
        nullable: true,
        description:
            "The format for date/time information in the x-field of the dataset (default: " +
            ISO8601_DATETIME_FORMAT +
            ")",
    })
    format: string;

    @Field({
        nullable: true,
        description: "The timezone for the date/time information in the x-field of the dataset",
        defaultValue: constants.DEFAULTS.TIMEZONE,
    })
    timezone: string;

    @Field({ nullable: true, description: "Sort ascending (true) or descending (false)", defaultValue: true })
    sortAscending: true;

    ensureDefaults() {
        if (!Object.prototype.hasOwnProperty.call(this, "timezone")) {
            this.timezone = constants.DEFAULTS.TIMEZONE;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "format")) {
            this.format = ISO8601_DATETIME_FORMAT;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "sortAscending")) {
            this.sortAscending = true;
        }
    }
}

/* --------- Dataset --------- */
export interface Dataset {
    id: string;
    name: string | undefined;
    fromCache: boolean;
    data: DataElement[];
}

export interface DataElement {
    x: string;
    y: number;
}

@ObjectType()
export class GraphQLDataElement implements DataElement {
    constructor(x: string, y: number) {
        this.x = x;
        this.y = y;
    }

    @Field()
    x: string;

    @Field()
    y: number;
}

/* ------ Power Price query ------- */
@InputType()
export class PowerPriceQueryFilterInput {
    @Field({
        nullable: true,
        description: "The date for the power price formatted as YYYY-MM-DD. If not specified uses current date.",
    })
    @Matches(/\d{4}-\d{2}-\d{2}/)
    date: string;

    @Field({
        nullable: true,
        defaultValue: false,
        description: "Cached data is returned if found. Set to true to always fetch a fresh copy of the data.",
    })
    ignoreCache: boolean;
}

/* --------- Ungrouped data query -------- */
@InputType()
class BaseQueryFilterInput {
    @Field(() => [String])
    sensorIds: string[];
}

@InputType()
export class UngroupedQueryDateFilterInput extends BaseQueryFilterInput {
    @Field({ nullable: false })
    start: Date;

    @Field({ nullable: false })
    end: Date;
}

@InputType()
export class UngroupedQueryCountFilterInput extends BaseQueryFilterInput {
    @Field({ nullable: true, defaultValue: 100 })
    count: number;
}

@InputType()
export class UngroupedQueryFormatInput implements IEnsureDefaults {
    @Field({ nullable: true, defaultValue: true })
    applyScaleFactor: boolean;

    @Field({ nullable: true, defaultValue: "UTC" })
    timezone: string;

    @Field({ nullable: true, defaultValue: ISO8601_DATETIME_FORMAT })
    format: string;

    @Field({ nullable: true, defaultValue: 3 })
    decimals: number;

    ensureDefaults() {
        if (!Object.prototype.hasOwnProperty.call(this, "timezone")) {
            this.timezone = "UTC";
        }
        if (!Object.prototype.hasOwnProperty.call(this, "format")) {
            this.format = ISO8601_DATETIME_FORMAT;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "decimals")) {
            this.decimals = 3;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "applyScaleFactor")) {
            this.applyScaleFactor = true;
        }
    }
}

/* ---------- Grouped date query ----------- */
@InputType()
export class GroupedQueryDateFilterInput extends BaseQueryFilterInput {
    @Field({
        nullable: false,
        description: "The start date/time",
    })
    start: Date;

    @Field({
        nullable: false,
        description: "The end date/time",
    })
    end: Date;
}

@InputType()
export class GroupedQueryOffsetFilterInput extends BaseQueryFilterInput {
    @Field(() => CounterQueryAdjustBy, { nullable: false })
    @IsEnum(CounterQueryAdjustBy)
    adjustBy: CounterQueryAdjustBy;

    @Field({
        nullable: true,
        defaultValue: 0,
        description: "The number of units we adjust the start timestamp by using the supplied unit to adjust by",
    })
    start: number;

    @Field({
        nullable: true,
        defaultValue: 0,
        description: "The number of units we adjust the end timestamp by using the supplied unit to adjust by",
    })
    end: number;
}

@InputType()
export class GroupedQueryGroupByInput {
    @Field(() => DataQueryGroupBy, { nullable: false })
    @IsEnum(DataQueryGroupBy)
    groupBy: DataQueryGroupBy;
}

@InputType()
export class GroupedQueryFormatInput implements IEnsureDefaults {
    @Field({ nullable: true, defaultValue: 3 })
    decimals: number;

    @Field({ nullable: true, defaultValue: constants.DEFAULTS.TIMEZONE })
    timezone: string;

    @Field({ nullable: true, defaultValue: true })
    applyScaleFactor: boolean;

    @Field({
        nullable: true,
        defaultValue: false,
        description: "Adds the missing time series into the result set to fill in the result in case of missing data",
    })
    addMissingTimeSeries: boolean;

    ensureDefaults() {
        if (!Object.prototype.hasOwnProperty.call(this, "decimals")) {
            this.decimals = 3;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "timezone")) {
            this.timezone = constants.DEFAULTS.TIMEZONE;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "applyScaleFactor")) {
            this.applyScaleFactor = false;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "addMissingTimeSeries")) {
            this.addMissingTimeSeries = false;
        }
    }
}

const getSensorsForSensorIDs = async (sensorIds: string[], storage: StorageService, user: types.BackendIdentity) => {
    return Promise.all(
        sensorIds.map((sensorId) => {
            return storage.getSensorOrUndefined(user, sensorId);
        })
    );
};

const buildQueryForSensorType_Counter = (
    filter: GroupedQueryOffsetFilterInput,
    grouping: GroupedQueryGroupByInput,
    format: GroupedQueryFormatInput
) => {
    // figure out timezone
    const tz = format.timezone || constants.DEFAULTS.TIMEZONE;

    // create query with adjusted days
    const dataQuery = `
        actuals as 
            (with temp2 as 
                (with temp1 as 
                    (select dt, value 
                        from sensor_data 
                        where 
                            dt >= date_trunc('${filter.adjustBy}', current_timestamp at time zone '${tz}') at time zone '${tz}' - interval '${filter.start} ${filter.adjustBy}' 
                            and dt < date_trunc('${filter.adjustBy}', current_timestamp at time zone '${tz}') at time zone '${tz}' - interval '${filter.end} ${filter.adjustBy}' - interval '1 second' 
                            and id=$1 
                        order by dt desc
                ) select dt, value, value-lead(value,1) over (order by dt desc) diff_value from temp1) select to_char(dt at time zone '${tz}', '${grouping.groupBy}') period, sum(diff_value) as value from temp2 group by period order by period)`;

    // create actual query (adds whether to fill in time series)
    const query = (() => {
        if (!format.addMissingTimeSeries)
            return `with ${dataQuery} select period, sum(value) as value from actuals group by period order by period asc;`;
        return `
            with dt_series as (
                select 
                    to_char(dt, '${grouping.groupBy}') period, 0 as value 
                from 
                    generate_series(
                        date_trunc('${filter.adjustBy}', current_timestamp at time zone '${tz}') - interval '${filter.start} ${filter.adjustBy}', 
                        date_trunc('${filter.adjustBy}', current_timestamp at time zone '${tz}') - interval '${filter.end} ${filter.adjustBy}' - interval '1 minute', 
                        interval '1 hour'
                    ) dt group by period), 
            ${dataQuery} 
            select dt_series.period period, case when actuals.value != 0 then actuals.value else dt_series.value end from dt_series left join actuals on dt_series.period=actuals.period order by period asc`;
    })();

    return query;
};

const buildQueryForSensorType_Delta = (
    filter: GroupedQueryOffsetFilterInput,
    grouping: GroupedQueryGroupByInput,
    format: GroupedQueryFormatInput
) => {
    // create query with adjusted days
    const dataQuery = `select to_char(dt at time zone '${format.timezone}', '${grouping.groupBy}') period, sum(value) as value
    from sensor_data inner join sensor on sensor_data.id=sensor.id 
    where 
        dt >= date_trunc('${filter.adjustBy}', current_timestamp at time zone '${format.timezone}') at time zone '${format.timezone}' - interval '${filter.start} ${filter.adjustBy}' and 
        dt < date_trunc('${filter.adjustBy}', current_timestamp at time zone '${format.timezone}') at time zone '${format.timezone}' - interval '${filter.end} ${filter.adjustBy}' and 
        sensor.id=$1 
    group by period 
    order by period asc`;

    // create actual query (adds whether to fill in time series)
    const query = (() => {
        if (!format.addMissingTimeSeries) return dataQuery;
        return `
            with dt_series as (
                select 
                    to_char(dt, '${grouping.groupBy}') period, 0 as value 
                from 
                    generate_series(
                        date_trunc('${filter.adjustBy}', current_timestamp at time zone '${format.timezone}') - interval '${filter.start} ${filter.adjustBy}', 
                        date_trunc('${filter.adjustBy}', current_timestamp at time zone '${format.timezone}') - interval '${filter.end} ${filter.adjustBy}' - interval '1 minute', 
                        interval '1 hour'
                    ) dt group by period), 
            actuals as (${dataQuery}) 
            select dt_series.period period, case when actuals.value != 0 then actuals.value else dt_series.value end from dt_series left join actuals on dt_series.period=actuals.period order by period asc`;
    })();

    return query;
};

export const doGroupedQuery = async (
    filter: GroupedQueryDateFilterInput | GroupedQueryOffsetFilterInput,
    grouping: GroupedQueryGroupByInput,
    format: GroupedQueryFormatInput,
    storage: StorageService,
    user: types.BackendIdentity
) => {
    // get sensors
    const sensors = await getSensorsForSensorIDs(filter.sensorIds, storage, user);

    // method for formatting results from database
    const formatResult = (dbdata: (QueryResult<any> | undefined)[]) => {
        // create response
        const dss: Array<Dataset> = [];
        for (let i = 0; i < filter.sensorIds.length; i++) {
            const result = dbdata[i] as QueryResult;
            const sensor = sensors[i] as Sensor;

            let ds;
            if (!sensor) {
                // unknown sensor
                ds = new GraphQLDataset(filter.sensorIds[i], undefined);
            } else {
                const scaleFactor = format.applyScaleFactor ? sensor.scaleFactor : 1;
                ds = new GraphQLDataset(sensor.id, sensor.name);
                ds.data = result.rows.map((r: any) => {
                    return {
                        x: r.period,
                        y:
                            Math.floor((r.value || 0) * scaleFactor * Math.pow(10, format.decimals)) /
                            Math.pow(10, format.decimals),
                    } as DataElement;
                });
            }
            dss.push(ds);
        }
        return dss;
    };

    let dbdata: (QueryResult<any> | undefined)[] = [];
    if (filter instanceof GroupedQueryDateFilterInput) {
        dbdata = await doDateGroupedQuery(sensors, filter, grouping, format, storage, user);
    } else {
        dbdata = await doOffsetGroupedQuery(sensors, filter, grouping, format, storage, user);
    }

    // format
    const dss = formatResult(dbdata);

    // return
    return dss;
};

export const doDateGroupedQuery = async (
    sensors: (types.Sensor | undefined)[],
    filter: GroupedQueryDateFilterInput,
    grouping: GroupedQueryGroupByInput,
    format: GroupedQueryFormatInput,
    storage: StorageService,
    _user: types.BackendIdentity
): Promise<(QueryResult<any> | undefined)[]> => {
    const dbdata = await Promise.all(
        sensors.map((sensor) => {
            if (!sensor) return Promise.resolve(undefined);
            const sensorId = sensor.id;
            const str_start = moment.utc(filter.start).format(ISO8601_DATETIME_FORMAT);
            const str_end = moment.utc(filter.end).format(ISO8601_DATETIME_FORMAT);

            if (sensor.type === types.SensorType.counter) {
                var query = `with actuals as (with temp2 as (with temp1 as
    (select dt, value from sensor_data where dt >= '${str_start}' and dt < '${str_end}' and id='${sensorId}' order by dt desc) 
    select dt, value, value-lead(value,1) over (order by dt desc) diff_value from temp1) select to_char(dt at time zone '${format.timezone}', '${grouping.groupBy}') period, sum(diff_value) as value from temp2 group by period order by period) select period, sum(value) as value from actuals group by period order by period asc;`;
            } else if (sensor.type === types.SensorType.delta) {
                var query = `select 
                    to_char(dt at time zone '${format.timezone}', '${grouping.groupBy}') period, 
                    sum(value) as value 
                from sensor_data 
                where dt >= '${str_start}' and dt < '${str_end}' and id='${sensorId}' 
                group by period 
                order by period asc;`;
            } else if (sensor.type === types.SensorType.gauge) {
                var query = `select 
                    to_char(dt at time zone '${format.timezone}', '${grouping.groupBy}') period, 
                    avg(value) as value 
                from sensor_data 
                where dt >= '${str_start}' and dt < '${str_end}' and id='${sensorId}' 
                group by period 
                order by period asc;`;
            } else {
                return Promise.reject(Error(`Unsupported sensor type for grouped query <${sensor.type}>`));
            }

            // return
            return storage.dbService!.query(query);
        })
    );
    return dbdata;
};

export const doOffsetGroupedQuery = async (
    sensors: (types.Sensor | undefined)[],
    filter: GroupedQueryOffsetFilterInput,
    grouping: GroupedQueryGroupByInput,
    format: GroupedQueryFormatInput,
    storage: StorageService,
    _user: types.BackendIdentity
): Promise<(QueryResult<any> | undefined)[]> => {
    // create a query per sensor using correct SQL
    const dbdata = await Promise.all(
        sensors.map((sensor) => {
            if (!sensor) return Promise.resolve(undefined);
            let query = "";
            switch (sensor.type) {
                case types.SensorType.counter:
                    query = buildQueryForSensorType_Counter(filter, grouping, format);
                    break;
                case types.SensorType.delta:
                    query = buildQueryForSensorType_Delta(filter, grouping, format);
                    break;
                default:
                    throw Error(`Supplied sensor type (${sensor.type}) does not support grouped queries`);
            }
            return storage.dbService!.query(query, sensor.id);
        })
    );

    // return
    return dbdata;
};

export const ungroupedQuery = async (
    filter: UngroupedQueryCountFilterInput | UngroupedQueryDateFilterInput,
    format: UngroupedQueryFormatInput,
    storage: StorageService,
    user: types.BackendIdentity
) => {
    const sensors = await getSensorsForSensorIDs(filter.sensorIds, storage, user);

    const dbdata = await Promise.all(
        filter.sensorIds.map((sensorId) => {
            if (filter instanceof UngroupedQueryDateFilterInput) {
                return storage.getSamplesForSensor(
                    user,
                    sensorId,
                    filter.start,
                    filter.end,
                    1,
                    format.applyScaleFactor
                );
            } else {
                return storage.getLastNSamplesForSensor(user, sensorId, filter.count, format.applyScaleFactor);
            }
        })
    );

    // build dataset(s);
    const dss: Array<Dataset> = [];
    for (let i = 0; i < filter.sensorIds.length; i++) {
        const result = dbdata[i] as types.SensorSample[];
        const sensor = sensors[i] as Sensor;
        let ds;
        if (!sensor) {
            // unknown sensor
            ds = new GraphQLDataset(filter.sensorIds[i], undefined);
        } else {
            ds = new GraphQLDataset(sensor.id, sensor.name);
            ds.data = result
                .map((r) => {
                    return {
                        x: moment.utc(r.dt).tz(format.timezone).format(format.format),
                        y: Math.floor((r.value || 0) * Math.pow(10, format.decimals)) / Math.pow(10, format.decimals),
                    };
                })
                .reverse();
        }
        dss.push(ds);
    }

    return dss;
};

const logger = new Logger("dataquery-service");

export class DataQueryService extends types.BaseService {
    public static NAME = "dataquery";
    private storage: StorageService;

    constructor() {
        super(DataQueryService.NAME);
        this.dependencies = [StorageService.NAME];
    }

    async init(callback: (err?: Error) => {}, services: types.BaseService[]) {
        logger.info(`Initializing ${DataQueryService.NAME}-service`);
        this.storage = services[0] as StorageService;
        callback();
    }

    async groupedQuery(
        filter: GroupedQueryDateFilterInput | GroupedQueryOffsetFilterInput,
        grouping: GroupedQueryGroupByInput,
        format: GroupedQueryFormatInput,
        user: types.BackendIdentity
    ) {
        return doGroupedQuery(filter, grouping, format, this.storage, user);
    }

    async ungroupedQuery(
        filter: UngroupedQueryCountFilterInput | UngroupedQueryDateFilterInput,
        format: UngroupedQueryFormatInput,
        user: types.BackendIdentity
    ) {
        return ungroupedQuery(filter, format, this.storage, user);
    }
}
