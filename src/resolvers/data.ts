import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Ctx, registerEnumType } from "type-graphql";
import * as types from "../types";
import { IsEnum } from "class-validator";
import { Sensor } from "./sensor";
import { QueryResult } from "pg";

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
    week = "YYYY IW",
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

@ObjectType()
class Dataset {
    constructor(id : string, name : string | undefined) {
        this.id=id;
        this.name=name;
        this.data = [];
    }
    @Field(() => ID)
    id : string;

    @Field(() => String, {nullable: true})
    name : string | undefined;

    @Field(() => [DataElement])
    data : DataElement[]
}

@ObjectType()
class DataElement {
    @Field()
    x : string;

    @Field()
    y : number;
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
        return ctx.storage.getSensorOrUndefined(id);
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
            ds = new Dataset(data.sensorIds[i], undefined);
        } else {
            const scaleFactor = sensor.scaleFactor;
            ds = new Dataset(sensor.id, sensor.name);
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
    @Query(() => [Dataset], { description: "Returns data for requested sensors grouped as requested", nullable: false })
    async groupedQuery(@Arg("data") data : GroupedQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
        return doGroupedQuery(data, ctx);
    }

    @Query(() => [Dataset], { description: "Returns data for requested sensors", nullable: false })
    async ungroupedQuery(@Arg("data") data : GaugeQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensors = await Promise.all(data.sensorIds.map(sensorId => {
            return ctx.storage.getSensorOrUndefined(sensorId);
        }))
        const dbdata = await Promise.all(data.sensorIds.map(sensorId => {
            return ctx.storage.getLastNSamplesForSensor(sensorId, data.sampleCount);
        }))
        
        // build dataset(s);
        const dss : Array<Dataset> = [];
        for (let i=0; i<data.sensorIds.length; i++) {
            const result = dbdata[i] as types.SensorSample[];
            const sensor = sensors[i] as Sensor;
            let ds;
            if (!sensor) {
                // unknown sensor
                ds = new Dataset(data.sensorIds[i], undefined);
            } else {
                const scaleFactor = sensor.scaleFactor;
                ds = new Dataset(sensor.id, sensor.name);
                ds.data = result.map(r => {
                    return {
                        "x": r.dt.toISOString(),
                        "y": Math.floor((r.value || 0) * scaleFactor * Math.pow(10, data.decimals)) / Math.pow(10, data.decimals)
                    }
                })
            }
            dss.push(ds);
        }
        
        return dss;
    }
}
