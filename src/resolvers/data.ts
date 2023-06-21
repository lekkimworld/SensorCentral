import { Resolver, Query, Arg, Ctx, registerEnumType } from "type-graphql";
import * as types from "../types";
import moment from "moment";
import constants from "../constants";
import { ISO8601_DATETIME_FORMAT } from "../constants";
import { CounterQueryAdjustBy, DataElement, DataQueryGroupBy, DataQueryService, GraphQLDataElement, GraphQLDataset, GroupedQueryDateFilterInput, GroupedQueryFormatInput, GroupedQueryGroupByInput, GroupedQueryOffsetFilterInput, PowerConsumptionQueryFilterInput, PowerConsumptionQueryFormatInput, PowerDataQueryFilterInput, PowerDataQueryFormatInput, PowerPriceQueryFilterInput, UngroupedQueryCountFilterInput, UngroupedQueryDateFilterInput, UngroupedQueryFormatInput, ungroupedQuery } from "../services/dataquery-service";
//@ts-ignore
import {lookupService} from "../configure-services";
const nordpool = require("nordpool");


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
