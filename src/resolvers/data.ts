import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Ctx, registerEnumType } from "type-graphql";
import * as types from "../types";
import { IsEnum } from "class-validator";

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
}

@Resolver()
export class CounterQueryResolver {
    @Query(() => [Dataset], { description: "Returns data for requested sensors grouped as requested", nullable: false })
    async counterGroupedQuery(@Arg("data") data : GroupedQueryInput, @Ctx() ctx : types.GraphQLResolverContext) {
        // create query with adjusted days
        const query = `select sensor.id id, sensor.name as name, to_char(dt at time zone $2, '${data.groupBy}') period, sum(value) as value
        from sensor_data inner join sensor on sensor_data.id=sensor.id 
        where 
            dt >= date_trunc('${data.adjustBy}', current_timestamp at time zone $2) at time zone $2 - interval '${data.start} ${data.adjustBy}' and 
            dt < date_trunc('${data.adjustBy}', current_timestamp at time zone $2) at time zone $2 - interval '${data.end} ${data.adjustBy}' and 
            sensor.id=$1 
        group by sensor.id, period 
        order by sensor.id asc, period asc;`;
        console.log(query);

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
}
