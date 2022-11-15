import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Ctx, registerEnumType } from "type-graphql";
import * as types from "../types";
import { IsEnum, Matches } from "class-validator";
import { Sensor } from "./sensor";
import { QueryResult } from "pg";
import moment from "moment";
import constants from "../constants";
import { ISO8601_DATETIME_FORMAT } from "../constants";
const nordpool = require("nordpool");

enum DataQueryGroupBy {
    year = "YYYY",
    month = "YYYY-MM",
    week = "YYYY W",
    day = "YYYY-MM-DD",
    hour = "YYYY-MM-DD HH24"
}
registerEnumType(DataQueryGroupBy, {
    "name": "DataQueryGroupBy",
    "description": "How resulting values are grouped"
})

enum CounterQueryAdjustBy {
    year = "year",
    month = "month",
    week = "week",
    day = "day"
}
registerEnumType(CounterQueryAdjustBy, {
    "name": "CounterQueryAdjustBy",
    "description": "How we adjust the time period queried for"
})

// ************************************************
// power data
registerEnumType(types.PowerPhase, {
    "name": "PowerPhase",
    "description": "The power phase queried for"
})

registerEnumType(types.PowerType, {
    name: "PowerType",
    description: "The type of power data queried for",
});

interface IEnsureDefaults {
    ensureDefaults() : void;
}

@InputType()
class PowerConsumptionQueryFilterInput {
    @Field({ nullable: false, description: "The sensor ID of the power meter" })
    id: string;

    @Field({ nullable: false, description: "Start date/time in ISO8601 format" })
    start: Date;

    @Field({ nullable: false, description: "End date/time in ISO8601 format" })
    end: Date;
}

@InputType()
class PowerConsumptionQueryFormatInput implements IEnsureDefaults {
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
class PowerDataQueryFilterInput {
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
class PowerDataQueryFormatInput implements IEnsureDefaults {
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

@ObjectType()
class GraphQLDataset implements Dataset{
    constructor(id : string, name : string | undefined) {
        this.id = id;
        this.name = name;
        this.data = [];
        this.fromCache = false;
    }

    @Field(() => ID)
    id : string;

    @Field(() => String, {nullable: true})
    name : string | undefined;

    @Field(() => Boolean, {nullable: false})
    fromCache : boolean;

    @Field(() => [GraphQLDataElement])
    data : DataElement[]
}

export interface DataElement {
    x: string;
    y: number;
}

@ObjectType()
class GraphQLDataElement implements DataElement{
    constructor(x : string, y : number) {
        this.x = x;
        this.y = y;
    }

    @Field()
    x : string;

    @Field()
    y : number;
}

/* ------ Power Price query ------- */
@InputType()
class PowerPriceQueryFilterInput {
    @Field({nullable: true, description: "The date for the power price formatted as YYYY-MM-DD. If not specified uses current date."})
    @Matches(/\d{4}-\d{2}-\d{2}/)
    date : string;

    @Field({nullable: true, defaultValue: false, description: "Cached data is returned if found. Set to true to always fetch a fresh copy of the data."})
    ignoreCache : boolean;
}

/* --------- Ungrouped data query -------- */
@InputType({isAbstract: true})
class BaseQueryFilterInput {
    @Field(() => [String])
    sensorIds: string[];
}

@InputType()
class UngroupedQueryDateFilterInput extends BaseQueryFilterInput {
    @Field({ nullable: false })
    start: Date;

    @Field({ nullable: false })
    end: Date;
}

@InputType()
class UngroupedQueryCountFilterInput extends BaseQueryFilterInput {
    @Field({ nullable: true, defaultValue: 100 })
    count: number;
}

@InputType()
class UngroupedQueryFormatInput implements IEnsureDefaults {
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
class GroupedQueryDateFilterInput extends BaseQueryFilterInput {
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
class GroupedQueryOffsetFilterInput extends BaseQueryFilterInput {
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
class GroupedQueryGroupByInput {
    @Field(() => DataQueryGroupBy, { nullable: false })
    @IsEnum(DataQueryGroupBy)
    groupBy: DataQueryGroupBy;
}

@InputType()
class GroupedQueryFormatInput implements IEnsureDefaults {
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

const getSensorsForSensorIDs = async (sensorIds : string[], ctx: types.GraphQLResolverContext) => {
    return Promise.all(
        sensorIds.map((sensorId) => {
            return ctx.storage.getSensorOrUndefined(ctx.user, sensorId);
        })
    );
}

const buildQueryForSensorType_Counter = (
    filter: GroupedQueryOffsetFilterInput,
    grouping: GroupedQueryGroupByInput,
    format: GroupedQueryFormatInput
) => {
    // figure out timezone
    const tz = format.timezone || "Europe/Copenhagen";

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

const doGroupedQuery = async (
    filter: GroupedQueryDateFilterInput | GroupedQueryOffsetFilterInput,
    grouping: GroupedQueryGroupByInput,
    format: GroupedQueryFormatInput, 
    ctx: types.GraphQLResolverContext
) => {
    // get sensors
    const sensors = await getSensorsForSensorIDs(filter.sensorIds, ctx);

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
                        y: Math.floor((r.value || 0) * scaleFactor * Math.pow(10, format.decimals)) / Math.pow(10, format.decimals),
                    } as DataElement;
                });
            }
            dss.push(ds);
        }
        return dss;
    };

    let dbdata: (QueryResult<any> | undefined)[] = [];
    if (filter instanceof GroupedQueryDateFilterInput) {
        dbdata = await doDateGroupedQuery(sensors, filter, grouping, format, ctx);
    } else {
        dbdata = await doOffsetGroupedQuery(sensors, filter, grouping, format, ctx);
    }

    // format
    const dss = formatResult(dbdata);

    // return
    return dss;
};

const doDateGroupedQuery = async (
    sensors : (types.Sensor|undefined)[],
    filter:GroupedQueryDateFilterInput, 
    grouping: GroupedQueryGroupByInput,
    format : GroupedQueryFormatInput, 
    ctx : types.GraphQLResolverContext
) : Promise<(QueryResult<any>|undefined)[]> => {

    const dbdata = await Promise.all(
        sensors.map((sensor) => {
            if (!sensor) return Promise.resolve(undefined);
            const sensorId = sensor.id;
            const str_start = moment.utc(filter.start).format(ISO8601_DATETIME_FORMAT);
            const str_end = moment.utc(filter.end).format(ISO8601_DATETIME_FORMAT);

            if (sensor.type === types.SensorType.counter) {
                var query = `with actuals as (with temp2 as (with temp1 as
    (select dt, value from sensor_data where dt >= '${str_start}' and dt < '${str_end}' and id='${sensorId}' order by dt desc) 
    select dt, value, value-lead(value,1) over (order by dt desc) diff_value from temp1) select to_char(dt at time zone '${
        format.timezone
    }', '${
                    grouping.groupBy
                }') period, sum(diff_value) as value from temp2 group by period order by period) select period, sum(value) as value from actuals group by period order by period asc;`;
            } else if (sensor.type === types.SensorType.delta) {
                var query = `select 
                    to_char(dt at time zone '${format.timezone}', '${
                    grouping.groupBy
                }') period, 
                    sum(value) as value 
                from sensor_data 
                where dt >= '${str_start}' and dt < '${str_end}' and id='${sensorId}' 
                group by period 
                order by period asc;`;
            } else if (sensor.type === types.SensorType.gauge) {
                var query = `select 
                    to_char(dt at time zone '${format.timezone}', '${
                    grouping.groupBy
                }') period, 
                    avg(value) as value 
                from sensor_data 
                where dt >= '${str_start}' and dt < '${str_end}' and id='${sensorId}' 
                group by period 
                order by period asc;`;
            } else {
                return Promise.reject(Error(`Unsupported sensor type for grouped query <${sensor.type}>`));
            }

            // return
            return ctx.storage.dbService!.query(query);
        })
    );
    return dbdata;
}

const doOffsetGroupedQuery = async (
    sensors : (types.Sensor|undefined)[],
    filter: GroupedQueryOffsetFilterInput,
    grouping: GroupedQueryGroupByInput,
    format: GroupedQueryFormatInput,
    ctx: types.GraphQLResolverContext
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
            return ctx.storage.dbService!.query(query, sensor.id);
        })
    );

    // return
    return dbdata;
};

const ungroupedQuery = async (
    filter: UngroupedQueryCountFilterInput | UngroupedQueryDateFilterInput,
    format: UngroupedQueryFormatInput,
    ctx: types.GraphQLResolverContext
) => {
    const sensors = await getSensorsForSensorIDs(filter.sensorIds, ctx);

    const dbdata = await Promise.all(
        filter.sensorIds.map((sensorId) => {
            if (filter instanceof UngroupedQueryDateFilterInput) {
                return ctx.storage.getSamplesForSensor(
                    ctx.user,
                    sensorId,
                    filter.start,
                    filter.end,
                    1,
                    format.applyScaleFactor
                );
            } else {
                return ctx.storage.getLastNSamplesForSensor(
                    ctx.user,
                    sensorId,
                    filter.count,
                    format.applyScaleFactor
                );
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

@Resolver()
export class DataQueryResolver {
    @Query(() => [GraphQLDataset], {
        description: "Returns data for requested sensors grouped as requested",
        nullable: false,
    })
    async dataGroupedOffsetQuery(
        @Arg("filter") filter: GroupedQueryOffsetFilterInput,
        @Arg("grouping") grouping: GroupedQueryGroupByInput,
        @Arg("format", { nullable: true, defaultValue: {} }) format: GroupedQueryFormatInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        format.ensureDefaults();
        return doGroupedQuery(filter, grouping, format, ctx);
    }

    @Query(() => [GraphQLDataset], {
        description: "Returns data for requested sensors with the data grouped as requested",
        nullable: false,
    })
    async dataGroupedDateQuery(
        @Arg("filter") filter: GroupedQueryDateFilterInput,
        @Arg("grouping") grouping: GroupedQueryGroupByInput,
        @Arg("format", { nullable: true, defaultValue: {} }) format: GroupedQueryFormatInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        format.ensureDefaults();
        return doGroupedQuery(filter, grouping, format, ctx);
    }

    @Query(() => [GraphQLDataset], {
        description:
            "Returns an array of datasets for the requested sensors with the latest X (based on the count provided) number of samples.",
        nullable: false,
    })
    async dataUngroupedCountQuery(
        @Arg("filter") filter: UngroupedQueryCountFilterInput,
        @Arg("format", {
            nullable: true,
            defaultValue: {},
        })
        format: UngroupedQueryFormatInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        format.ensureDefaults();
        return ungroupedQuery(filter, format, ctx);
    }

    @Query(() => [GraphQLDataset], {
        description: "Returns an array of datasets for the requested sensors based on start and end date/time.",
        nullable: false,
    })
    async dataUngroupedDateQuery(
        @Arg("filter") filter: UngroupedQueryDateFilterInput,
        @Arg("format", {
            nullable: true,
            defaultValue: {},
        })
        format: UngroupedQueryFormatInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        format.ensureDefaults();
        return ungroupedQuery(filter, format, ctx);
    }

    @Query(() => GraphQLDataset, {
        description: "Returns kWh consumption data (grouped by hour) for a powermeter",
    })
    async powerConsumptionQuery(
        @Arg("filter") filter: PowerConsumptionQueryFilterInput,
        @Arg("format", { nullable: true, defaultValue: {} }) format: PowerConsumptionQueryFormatInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<GraphQLDataset> {
        // ensure defaults
        format.ensureDefaults();

        // get sensor to ensure access
        const sensor = await ctx.storage.getSensor(ctx.user, filter.id);

        // query
        const results = await ctx.storage.dbService!.query(
            `with data as (select dt, (voltagephasel1*currentphasel1)+(voltagephasel2*currentphasel2)+(voltagephasel3*currentphasel3) as value from powermeter_data where dt >= $2 and dt < $3 and id=$1 and not currentphasel1 is null order by dt desc)
            select to_char(dt at time zone '${format.timezone}', 'YYYY-MM-DD HH24') as period, sum(value)/1000 as value from data group by period order by period asc;
            `,
            filter.id,
            filter.start,
            filter.end
        );

        // build dataset
        const dataset = {
            id: filter.id,
            name: sensor.name,
            data: results.rows.map((row) => {
                return {
                    x: row.period,
                    y: row.value,
                };
            }),
        } as GraphQLDataset;

        // return
        return dataset;
    }

    @Query(() => GraphQLDataset, {
        description: "Returns power data from a powermeter",
    })
    async powerPhaseDataQuery(
        @Arg("filter") filter: PowerDataQueryFilterInput,
        @Arg("format", { nullable: true, defaultValue: {} }) format: PowerDataQueryFormatInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<GraphQLDataset> {
        // defaults for formatting
        const sortAscending =
            Object.prototype.hasOwnProperty.call(format, "sortAscending") && format.sortAscending ? true : false;
        const dtFormat = format.format || ISO8601_DATETIME_FORMAT;

        // get sensor to ensure access
        const sensor = await ctx.storage.getSensor(ctx.user, filter.id);

        // get data
        const samples = await ctx.storage.getPowerPhaseData(
            ctx.user,
            filter.id,
            filter.start,
            filter.end,
            filter.type,
            filter.phase
        );

        // sort
        samples.sort((a, b) => {
            const delta = b.dt.getTime() - a.dt.getTime();
            return (sortAscending ? -1 : 1) * delta;
        });

        // convert to dataset
        const dataset = samples.reduce((set, sample) => {
            set.data.push(new GraphQLDataElement(moment.utc(sample.dt).format(dtFormat), sample.value));
            return set;
        }, new GraphQLDataset(sensor.id, sensor.name));

        // return
        return dataset;
    }

    @Query(() => GraphQLDataset, {
        description: "Returns hourly prices for the supplied date or today if no date supplied",
    })
    async powerPriceQuery(
        @Arg("filter") filter: PowerPriceQueryFilterInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<GraphQLDataset> {
        // calc date to ask for
        const m = filter.date ? moment(filter.date, "YYYY-MM-DD") : moment();

        // create dataset
        const ds = new GraphQLDataset("power", m.format("DD-MM-YYYY"));

        // see if we could potentially have the data
        const midnight = moment().hour(0).minute(0).second(0).millisecond(0).add(1, "day");
        if (midnight.diff(m) <= 0) {
            // supplied date is in the future
            const tomorrowMidnight = moment().hour(0).minute(0).second(0).millisecond(0).add(2, "day");
            const today2pm = moment().hour(14).minute(0).second(0).millisecond(0);
            if (tomorrowMidnight.diff(m) <= 0) {
                // supplied date is after tomorrow midnight - we never have
                // that data
                return ds;
            } else {
                // we could have the data for tomorrow if it's after 2pm
                if (moment().diff(today2pm) < 0) {
                    // it's before 2pm - we cannot have the data yet
                    return ds;
                }
            }
        }

        // look in cache if allowed
        if (!filter.ignoreCache) {
            const data = await ctx.storage.getPowerPriceData(m.format("YYYY-MM-DD"));
            if (data) {
                // found in cache
                ds.data = data as any as DataElement[];
                ds.fromCache = true;
                return ds;
            }
        }

        // get data
        try {
            const opts = {
                currency: constants.DEFAULTS.NORDPOOL.CURRENCY,
                area: constants.DEFAULTS.NORDPOOL.AREA,
                date: m.format("YYYY-MM-DD"),
            };
            const results = await new nordpool.Prices().hourly(opts);

            // map data
            ds.data = results.map((v: any) => {
                let date = moment.utc(v.date);
                let price = Number.parseFloat((v.value / 1000).toFixed(2)); // unit i MWh
                let time = date.tz(constants.DEFAULTS.TIMEZONE).format("H:mm");
                return new GraphQLDataElement(time, price);
            });

            // cache
            ctx.storage.setPowerPriceData(m.format("YYYY-MM-DD"), ds.data);

            // return
            return ds;
        } catch (err) {
            throw Error(`Unable to load powerquery data for date (${m.format("YYYY-MM-DD")}, ${err.message})`);
        }
    }
}
