import moment from "moment";
import { Arg, Ctx, Field, InputType, Query, Resolver } from "type-graphql";
import * as types from "../types";
import {
    GraphQLDataset
} from "./resolver-types";
//@ts-ignore
import { lookupService } from "../configure-services";
//@ts-ignore
import { Matches } from "class-validator";
import { PowerpriceService } from "../services/powerprice-service";

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


@Resolver()
export class PowerPriceResolver {
    
    @Query(() => GraphQLDataset, {
        description: "Returns hourly prices for the supplied date or today if no date supplied",
    })
    async powerPriceQuery(
        @Arg("filter") filter: PowerPriceQueryFilterInput,
        @Ctx() _ctx: types.GraphQLResolverContext
    ): Promise<GraphQLDataset> {
        // calc date to ask for
        const m = filter.date ? moment(filter.date, "YYYY-MM-DD") : moment();

        // get service
        const ppSvc = await lookupService(PowerpriceService.NAME) as PowerpriceService;
        const ds = await ppSvc.getPowerdataForMoment(m, filter.ignoreCache);
        const result = new GraphQLDataset(
            ds.id, ds.name
        )
        result.fromCache = ds.fromCache;
        result.data = ds.data;
        return result;
    }
}
