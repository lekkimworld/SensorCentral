import moment from "moment";
import { Arg, Ctx, Query, Resolver, registerEnumType } from "type-graphql";
import { ISO8601_DATETIME_FORMAT } from "../constants";
import { CounterQueryAdjustBy, DataQueryGroupBy, DataQueryService, GroupedQueryDateFilterInput, GroupedQueryFormatInput, GroupedQueryGroupByInput, GroupedQueryOffsetFilterInput, UngroupedQueryCountFilterInput, UngroupedQueryDateFilterInput, UngroupedQueryFormatInput, ungroupedQuery } from "../services/dataquery/dataquery-service";
import * as types from "../types";
import { PowerpriceService } from "../services/powerprice-service";
//@ts-ignore
import { lookupService } from "../configure-services";
import { GraphQLDataElement, GraphQLDataset } from "./resolver-types";
import { PowerConsumptionQueryFilterInput, PowerConsumptionQueryFormatInput, PowerDataQueryFilterInput, PowerDataQueryFormatInput } from "../services/dataquery/powerdata-query";
import { PowerPriceQueryFilterInput } from "./powerprice";


registerEnumType(DataQueryGroupBy, {
    "name": "DataQueryGroupBy",
    "description": "How resulting values are grouped"
})
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
        const srvc = await lookupService(DataQueryService.NAME) as DataQueryService;
        return srvc.groupedQuery(filter, grouping, format, ctx.user);
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
        const srvc = (await lookupService(DataQueryService.NAME)) as DataQueryService;
        return srvc.groupedQuery(filter, grouping, format, ctx.user);

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
        return ungroupedQuery(filter, format, ctx.storage, ctx.user);
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
        return ungroupedQuery(filter, format, ctx.storage, ctx.user);
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
                    y: row.value / 1000,
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
        @Ctx() _ctx: types.GraphQLResolverContext
    ): Promise<GraphQLDataset> {
        // calc date to ask for
        const m = filter.date ? moment(filter.date, "YYYY-MM-DD") : moment();

        // ask service
        const ppSvc = await lookupService(PowerpriceService.NAME) as PowerpriceService;
        const ds = await ppSvc.getPowerdataForMoment(m, filter.ignoreCache);
        const result = new GraphQLDataset(
            ds.id,
            ds.name
        );
        result.fromCache = ds.fromCache;
        result.data = ds.data;

        // return
        return result;
    }
}
