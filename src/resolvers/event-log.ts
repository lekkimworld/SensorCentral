import { Arg, Ctx, Field, Int, ObjectType, Query, Resolver } from "type-graphql";
import { GraphQLResolverContext } from "../types";
import { getService } from "../services/service-locator";
import { RedisService } from "../services/redis-service";
import constants from "../constants";

@ObjectType()
class EventLogEntry {
    @Field() timestamp: string;
    @Field() triggerType: string;
    @Field() targetId: string;
    @Field() targetName: string;
    @Field(() => String, { nullable: true }) targetPath?: string;
    @Field() actionType: string;
    @Field() actionDetail: string;
    @Field() success: boolean;
    @Field(() => String, { nullable: true }) error?: string;
    @Field(() => String, { nullable: true }) request?: string;
    @Field(() => String, { nullable: true }) response?: string;
}

@Resolver()
export class EventLogResolver {
    @Query(() => [EventLogEntry], { description: "Returns the event activity log for the current user" })
    async eventLog(
        @Ctx() ctx: GraphQLResolverContext,
        @Arg("limit", () => Int, { nullable: true }) limit?: number
    ): Promise<EventLogEntry[]> {
        const redis = getService<RedisService>(RedisService.NAME);
        const key = `event_log:${ctx.user.identity.callerId}`;
        const max = constants.DEFAULTS.EVENT_LOG.MAX_ENTRIES;
        const count = limit ? Math.min(limit, max) : max;
        const entries = await redis.getClient().lrange(key, 0, count - 1);
        return entries.map((raw) => {
            const parsed = JSON.parse(raw);
            const entry = new EventLogEntry();
            entry.timestamp = parsed.timestamp;
            entry.triggerType = parsed.triggerType;
            entry.targetId = parsed.targetId;
            entry.targetName = parsed.targetName || parsed.targetId;
            entry.targetPath = parsed.targetPath || undefined;
            entry.actionType = parsed.actionType;
            entry.actionDetail = parsed.actionDetail;
            entry.success = parsed.success;
            entry.error = parsed.error || undefined;
            entry.request = parsed.request || undefined;
            entry.response = parsed.response || undefined;
            return entry;
        });
    }
}
