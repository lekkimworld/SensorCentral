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
    name : string;

    @Field()
    value : number;
}

@InputType()
class GroupedQueryInput {
    @Field(() => [String])
    sensorIds : string[]

    @Field(() => CounterQueryTimezone, {nullable: true, defaultValue: CounterQueryTimezone.copenhagen})
    @IsEnum(CounterQueryTimezone)
    timezone : CounterQueryTimezone

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

const doGroupedQuery = async (query : string, data : GroupedQueryInput, ctx : types.GraphQLResolverContext) => {
    // create promises (one query per sensor for the sensor, one query per sensor for the data)
    let promises : Array<Promise<any>> = data.sensorIds.map(async id => {
        return ctx.storage.getSensorOrUndefined(id);
    })
    promises = promises.concat(data.sensorIds.map(async id => {
        return ctx.storage.dbService!.query(query, id)
    }));
    
    // evaluate all queries
    const results = await Promise.all(promises);
    
    // create response
    const dss : Array<Dataset> = [];
    for (let i=0; i<data.sensorIds.length; i++) {
        const result = results[data.sensorIds.length + i] as QueryResult;
        const sensor = results[i] as Sensor;
        let ds;
        if (!sensor) {
            // unknown sensor
            ds = new Dataset(data.sensorIds[i], undefined);
        } else {
            ds = new Dataset(sensor.id, sensor.name);
            ds.data = result.rows.map((r : any) => {
                return {
                    "name": r.period,
                    "value": r.value || 0
                } as DataElement;
            })
        }
        dss.push(ds);
    }
    
    return dss;
}

@Resolver()
export class CounterQueryResolver {
    @Query(() => [Dataset], { description: "Returns data for requested delta-type sensors grouped as requested", nullable: false })
    async deltaGroupedQuery(@Arg("data") data : GroupedQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
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

        return doGroupedQuery(query, data, ctx);
    }

    @Query(() => [Dataset], { description: "Returns data for requested countere-type sensors grouped as requested", nullable: false })
    async counterGroupedQuery(@Arg("data") data : GroupedQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
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

        return doGroupedQuery(query, data, ctx);
    }
}
