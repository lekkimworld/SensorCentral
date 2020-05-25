import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Ctx } from "type-graphql";
import * as types from "../types";
import { IsEnum } from "class-validator";

enum CounterQueryTimezone {
    copenhagen = "Europe/Copenhagen",
    utc = "UTC"
}

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
abstract class QueryInput {
    @Field(() => [String])
    sensorIds : string[]

    @Field({nullable: true, defaultValue: CounterQueryTimezone.copenhagen})
    @IsEnum(CounterQueryTimezone)
    timezone : CounterQueryTimezone

    @Field({nullable: true, defaultValue: 0})
    adjust : number
}

@InputType()
class DayQueryInput extends QueryInput{
    
}

@InputType()
class CalWeekQueryInput extends QueryInput{
    
}

@InputType()
class DaysQueryInput extends QueryInput{
    @Field({nullable: true, defaultValue: 7})
    days : number;
}

@InputType()
class MonthQueryInput extends QueryInput{
    
}

const queryAndMap = async (ctx : types.GraphQLResolverContext, query : string, data : QueryInput) => {
    // get data
    const results = await Promise.all(data.sensorIds.map(async id => {
        return ctx.storage.dbService!.query(query, id, data.timezone || "Europe/Copenhagen")
    }));
    
    // create response
    const dss = results.map((result, idx) => {
        if (!result || result.rowCount === 0) {
            const ds = new Dataset(data.sensorIds[idx], undefined);
            return ds;
        } else {
            const ds = new Dataset(result.rows[0].id, result.rows[0].name);
            ds.data = result.rows.map((r : any) => {
                return {
                    "name": r.period,
                    "value": r.value
                } as DataElement;
            })
            return ds;
        }
    })
    return dss;
}

@Resolver()
export class CounterQueryResolver {
    @Query(() => [Dataset], { description: "Returns data for requested sensors grouped by hour of the day", nullable: false })
    async counterQueryDay(@Arg("data") data : DayQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
        // create query with adjusted days
        const query = `select sensor.id id, sensor.name as name, to_char(dt at time zone $2, 'YYYY-MM-DD HH24') period, sum(value) as value
        from sensor_data inner join sensor on sensor_data.id=sensor.id 
        where 
            dt >= date_trunc('day', (current_timestamp - interval '${data.adjust} day') at time zone 'UTC') at time zone $2 and 
            dt < date_trunc('day', current_timestamp at time zone 'UTC' + interval '1 day' - interval '${data.adjust} day') at time zone $2 and 
            sensor.id=$1 
        group by sensor.id, period 
        order by sensor.id asc, period asc;`;

        // get data
        const dss = queryAndMap(ctx, query, data);
        return dss;
    }

    @Query(() => [Dataset], { description: "Returns data for requested sensors grouped by day in a calendar week", nullable: false })
    async counterQueryCalWeek(@Arg("data") data : CalWeekQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
        // create query with adjusted days
        const query = `select sensor.id id, sensor.name as name, to_char(dt at time zone $2, 'YYYY-MM-DD') period, sum(value) as value 
        from sensor_data inner join sensor on sensor.id=sensor_data.id where 
            dt >= ((date_trunc('week', current_timestamp) at time zone 'UTC') - interval '${data.adjust} week') at time zone $2 and 
            dt < ((date_trunc('week', current_timestamp) at time zone 'UTC') - interval '${data.adjust} week' + interval '1 week') at time zone $2 and 
            sensor.id=$1 
        group by sensor.id, period 
        order by sensor.id asc, period asc;`;

        // get data
        const dss = queryAndMap(ctx, query, data);
        return dss;
    }

    @Query(() => [Dataset], { description: "Returns data for requested sensors grouped by day in the last 7 days", nullable: false })
    async counterQuery7Days(@Arg("data") data : DaysQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
        // create query with adjusted days
        const query = `select sensor.id id, sensor.name as name, to_char(dt at time zone $2, 'YYYY-MM-DD') period, sum(value) as value 
        from sensor_data inner join sensor on sensor.id=sensor_data.id 
        where 
            dt >= date_trunc('day', (current_timestamp - interval '${(1+data.adjust)*7} days') at time zone 'UTC') at time zone $2 and 
            dt < date_trunc('day', (current_timestamp - interval '${data.adjust*7} days') at time zone 'UTC') at time zone $2 and 
            sensor.id=$1 
        group by sensor.id, period 
        order by sensor.id asc, period asc;`;

        // get data
        const dss = queryAndMap(ctx, query, data);
        return dss;
    }

    @Query(() => [Dataset], { description: "Returns data for requested sensors grouped by day in the current month", nullable: false })
    async counterQueryMonth(@Arg("data") data : MonthQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
        // create query with adjusted days
        const query = `select sensor.id id, sensor.name as name, to_char(dt at time zone $2, 'YYYY-MM-DD') period, sum(value) as value 
        from sensor_data inner join sensor on sensor_data.id=sensor.id 
        where 
            dt >= date_trunc('month', current_timestamp at time zone 'UTC' - interval '${data.adjust} months') at time zone $2 and 
            dt < (date_trunc('month', current_timestamp at time zone 'UTC') - interval '${-1 + data.adjust} month') at time zone $2 and 
            sensor.id=$1 
        group by sensor.id, period 
        order by sensor.id asc, period asc;`;

        // get data
        const dss = queryAndMap(ctx, query, data);
        return dss;
    }
}
