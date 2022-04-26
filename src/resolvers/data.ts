import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Ctx, registerEnumType } from "type-graphql";
import * as types from "../types";
import { IsEnum, Matches } from "class-validator";
import { Sensor } from "./sensor";
import { QueryResult } from "pg";
import moment from "moment";
import constants from "../constants";
const nordpool = require("nordpool");

enum CounterQueryTimezone {
    copenhagen = "Europe/Copenhagen",
    utc = "UTC"
}
registerEnumType(CounterQueryTimezone, {
    "name": "Timezone",
    "description": "Timezones supported"
})

enum CounterQueryGroupBy {
    year = "YYYY",
    month = "YYYY-MM",
    week = "YYYY W",
    day = "YYYY-MM-DD",
    hour = "YYYY-MM-DD HH24"
}
registerEnumType(CounterQueryGroupBy, {
    "name": "CounterQueryGroupBy",
    "description": "How resulting counter values are grouped"
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

@InputType()
class PowerDataQueryInput {
    @Field()
    id: string;

    @Field(() => types.PowerPhase, { nullable: false })
    @IsEnum(types.PowerPhase)
    phase: types.PowerPhase;

    @Field(() => types.PowerType, { nullable: false })
    @IsEnum(types.PowerType)
    type: types.PowerType;

    @Field({ nullable: false })
    start: Date;

    @Field({ nullable: false })
    end: Date;

    @Field({ nullable: true })
    format: string;

    @Field({ nullable: true, defaultValue: constants.DEFAULTS.TIMEZONE} )
    timezone: string;

    @Field({ nullable: true, defaultValue: true })
    sortAscending: true;
}




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

@InputType()
class PowerPriceQueryInput {
    @Field({nullable: true})
    @Matches(/\d{4}-\d{2}-\d{2}/)
    date : string;

    @Field({nullable: true, defaultValue: false})
    ignoreCache : boolean;
}

@InputType()
abstract class QueryInput {
    @Field(() => [String])
    sensorIds : string[]

    @Field(() => CounterQueryTimezone, {nullable: true, defaultValue: CounterQueryTimezone.copenhagen})
    @IsEnum(CounterQueryTimezone)
    timezone : CounterQueryTimezone

    @Field({nullable: true, defaultValue: 3})
    decimals : number
}

@InputType()
class GaugeQueryInput extends QueryInput {
    @Field({nullable:true, defaultValue: 100})
    sampleCount : number

    @Field({nullable:true})
    start : Date

    @Field({nullable:true})
    end : Date

    @Field({nullable: true, defaultValue: true})
    applyScaleFactor : boolean
}


@InputType()
class GroupedQueryInput extends QueryInput {
    @Field(() => CounterQueryGroupBy, {nullable: false})
    @IsEnum(CounterQueryGroupBy)
    groupBy : CounterQueryGroupBy

    @Field(() => CounterQueryAdjustBy, {nullable: false})
    @IsEnum(CounterQueryAdjustBy)
    adjustBy : CounterQueryAdjustBy

    @Field({nullable: true, defaultValue: 0, description: "The number of units we adjust the start timestamp by using the supplied unit to adjust by"})
    start : number

    @Field({nullable: true, defaultValue: 0, description: "The number of units we adjust the end timestamp by using the supplied unit to adjust by"})
    end : number

    @Field({nullable: true, defaultValue: false, description: "Adds the missing time series into the result set to fill in the result in case of missing data"})
    addMissingTimeSeries : boolean
}

const buildQueryForSensorType_Counter = (data : GroupedQueryInput) => {
    // figure out timezone
    const tz = data.timezone || "Europe/Copenhagen";

    // create query with adjusted days
    const dataQuery = `
        actuals as 
            (with temp2 as 
                (with temp1 as 
                    (select dt, value 
                        from sensor_data 
                        where 
                            dt >= date_trunc('${data.adjustBy}', current_timestamp at time zone '${tz}') at time zone '${tz}' - interval '${data.start} ${data.adjustBy}' 
                            and dt < date_trunc('${data.adjustBy}', current_timestamp at time zone '${tz}') at time zone '${tz}' - interval '${data.end} ${data.adjustBy}' - interval '1 second' 
                            and id=$1 
                        order by dt desc
                ) select dt, value, value-lead(value,1) over (order by dt desc) diff_value from temp1) select to_char(dt at time zone '${tz}', '${data.groupBy}') period, sum(diff_value) as value from temp2 group by period order by period)`

    // create actual query (adds whether to fill in time series)
    const query = (() => {
        if (!data.addMissingTimeSeries) return `with ${dataQuery} select period, sum(value) as value from actuals group by period order by period asc;`;
        return `
            with dt_series as (
                select 
                    to_char(dt, '${data.groupBy}') period, 0 as value 
                from 
                    generate_series(
                        date_trunc('${data.adjustBy}', current_timestamp at time zone '${tz}') - interval '${data.start} ${data.adjustBy}', 
                        date_trunc('${data.adjustBy}', current_timestamp at time zone '${tz}') - interval '${data.end} ${data.adjustBy}' - interval '1 minute', 
                        interval '1 hour'
                    ) dt group by period), 
            ${dataQuery} 
            select dt_series.period period, case when actuals.value != 0 then actuals.value else dt_series.value end from dt_series left join actuals on dt_series.period=actuals.period order by period asc`;
    })();

    return query;
}

const buildQueryForSensorType_Delta = (data : GroupedQueryInput) => {
    // figure out timezone
    const tz = data.timezone || "Europe/Copenhagen";

    // create query with adjusted days
    const dataQuery = `select to_char(dt at time zone '${tz}', '${data.groupBy}') period, sum(value) as value
    from sensor_data inner join sensor on sensor_data.id=sensor.id 
    where 
        dt >= date_trunc('${data.adjustBy}', current_timestamp at time zone '${tz}') at time zone '${tz}' - interval '${data.start} ${data.adjustBy}' and 
        dt < date_trunc('${data.adjustBy}', current_timestamp at time zone '${tz}') at time zone '${tz}' - interval '${data.end} ${data.adjustBy}' and 
        sensor.id=$1 
    group by period 
    order by period asc`;

    // create actual query (adds whether to fill in time series)
    const query = (() => {
        if (!data.addMissingTimeSeries) return dataQuery;
        return `
            with dt_series as (
                select 
                    to_char(dt, '${data.groupBy}') period, 0 as value 
                from 
                    generate_series(
                        date_trunc('${data.adjustBy}', current_timestamp at time zone '${tz}') - interval '${data.start} ${data.adjustBy}', 
                        date_trunc('${data.adjustBy}', current_timestamp at time zone '${tz}') - interval '${data.end} ${data.adjustBy}' - interval '1 minute', 
                        interval '1 hour'
                    ) dt group by period), 
            actuals as (${dataQuery}) 
            select dt_series.period period, case when actuals.value != 0 then actuals.value else dt_series.value end from dt_series left join actuals on dt_series.period=actuals.period order by period asc`;
    })();

    return query;
}

const doGroupedQuery = async (data : GroupedQueryInput, ctx : types.GraphQLResolverContext) => {
    // get sensors
    const sensors = await Promise.all(data.sensorIds.map(id => {
        return ctx.storage.getSensorOrUndefined(ctx.user, id);
    }))

    // create a query per sensor using correct SQL
    const dbdata = await Promise.all(sensors.map(sensor => {
        if (!sensor) return Promise.resolve(undefined);
        let query;
        switch (sensor.type) {
            case types.SensorType.counter:
                query = buildQueryForSensorType_Counter(data);
                break;
            case types.SensorType.delta:
                query = buildQueryForSensorType_Delta(data);
                break;
            default:
                throw Error(`Supplied sensor type (${sensor.type}) does not support grouped queries`);
        }
        return ctx.storage.dbService!.query(query, sensor.id);
    }))
    
    // create response
    const dss : Array<Dataset> = [];
    for (let i=0; i<data.sensorIds.length; i++) {
        const result = dbdata[i] as QueryResult;
        const sensor = sensors[i] as Sensor;
        
        let ds;
        if (!sensor) {
            // unknown sensor
            ds = new GraphQLDataset(data.sensorIds[i], undefined);
        } else {
            const scaleFactor = sensor.scaleFactor;
            ds = new GraphQLDataset(sensor.id, sensor.name);
            ds.data = result.rows.map((r : any) => {
                return {
                    "x": r.period,
                    "y": Math.floor((r.value || 0) * scaleFactor * Math.pow(10, data.decimals)) / Math.pow(10, data.decimals)
                } as DataElement;
            })
        }
        dss.push(ds);
    }
    
    // return
    return dss;
}

@Resolver()
export class CounterQueryResolver {
    @Query(() => [GraphQLDataset], {
        description: "Returns data for requested sensors grouped as requested",
        nullable: false,
    })
    async groupedQuery(@Arg("data") data: GroupedQueryInput, @Ctx() ctx: types.GraphQLResolverContext) {
        return doGroupedQuery(data, ctx);
    }

    @Query(() => [GraphQLDataset], { description: "Returns data for requested sensors", nullable: false })
    async ungroupedQuery(@Arg("data") data: GaugeQueryInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const sensors = await Promise.all(
            data.sensorIds.map((sensorId) => {
                return ctx.storage.getSensorOrUndefined(ctx.user, sensorId);
            })
        );
        const dbdata = await Promise.all(
            data.sensorIds.map((sensorId) => {
                if (data.start && data.end) {
                    return ctx.storage.getSamplesForSensor(
                        ctx.user,
                        sensorId,
                        data.start,
                        data.end,
                        1,
                        data.applyScaleFactor
                    );
                } else {
                    return ctx.storage.getLastNSamplesForSensor(
                        ctx.user,
                        sensorId,
                        data.sampleCount,
                        data.applyScaleFactor
                    );
                }
            })
        );

        // build dataset(s);
        const dss: Array<Dataset> = [];
        for (let i = 0; i < data.sensorIds.length; i++) {
            const result = dbdata[i] as types.SensorSample[];
            const sensor = sensors[i] as Sensor;
            let ds;
            if (!sensor) {
                // unknown sensor
                ds = new GraphQLDataset(data.sensorIds[i], undefined);
            } else {
                ds = new GraphQLDataset(sensor.id, sensor.name);
                ds.data = result
                    .map((r) => {
                        return {
                            x: r.dt.toISOString(),
                            y: Math.floor((r.value || 0) * Math.pow(10, data.decimals)) / Math.pow(10, data.decimals),
                        };
                    })
                    .reverse();
            }
            dss.push(ds);
        }

        return dss;
    }

    @Query(() => GraphQLDataset, {
        description: "Returns power data from a Powermeter"
    })
    async powerPhaseDataQuery(@Arg("data") data : PowerDataQueryInput, @Ctx() ctx : types.GraphQLResolverContext) : Promise<Dataset> {
        // get sensor to ensure access
        const sensor = await ctx.storage.getSensor(ctx.user, data.id);

        // get data
        const samples = await ctx.storage.getPowerPhaseData(
            ctx.user,
            data.id,
            data.start,
            data.end,
            data.type,
            data.phase
        );

        // sort
        samples.sort((a, b) => {
            const delta = b.dt.getTime() - a.dt.getTime();
            return (data.sortAscending ? -1 : 1) * delta;
        });

        // convert to dataset
        const dataset = samples.reduce((set, sample) => {
            set.data.push(
                new GraphQLDataElement(
                    moment
                        .utc(sample.dt)
                        .tz(data.timezone)
                        .format(data.format || constants.DEFAULTS.DATETIME_FORMAT),
                    sample.value
                )
            );
            return set;
        }, new GraphQLDataset(sensor.id, sensor.name));

        // return
        return dataset;
    }

    @Query(() => GraphQLDataset, {
        description: "Returns hourly prices for the supplied date or today if no date supplied",
    })
    async powerPriceQuery(@Arg("data") data: PowerPriceQueryInput, @Ctx() ctx: types.GraphQLResolverContext) {
        // calc date to ask for
        const m = data.date ? moment(data.date, "YYYY-MM-DD") : moment();

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
        if (!data.ignoreCache) {
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
