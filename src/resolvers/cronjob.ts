import { Resolver, ObjectType, Field, Arg, InputType, Query, Mutation, Ctx, registerEnumType, ID } from "type-graphql";
import { Length } from "class-validator";
import * as types from "../types";
import constants from "../constants";
import { AuthenticatorTemplate } from "../callout-authenticator-templates/templates";
import { v4 as uuid } from "uuid";
import getService from "../services/service-locator";
import CalloutService, { MIMETYPE_FORM, MIMETYPE_JSON } from "../services/callout-service";
import { Cron } from "croner";

registerEnumType(types.CronJobType, {
    name: "CronJobType",
    description: "The types of cron jobs that can be configured",
});

@ObjectType()
export class CronJobOutput {
    @Field(() => ID) id: string;
    @Field(() => types.CronJobType) jobType: types.CronJobType;
    @Field(() => Boolean) active: boolean;
    @Field(() => Number) frequencyMinutes: number;
    @Field(() => String, { nullable: true }) calloutId?: string;
    @Field(() => String, { nullable: true }) sensorId?: string;
    @Field(() => String, { nullable: true }) houseId?: string;
    @Field(() => String, { nullable: true }) deviceId?: string;
    @Field(() => String, { nullable: true }) cronExpression?: string;
}

@InputType()
export class CreateSmartmeCronJobInput {
    @Field(() => String)
    @Length(2, 128)
    clientId: string;

    @Field(() => String)
    @Length(2, 128)
    clientSecret: string;

    @Field(() => String)
    houseId: string;

    @Field(() => String)
    sensorId: string;

    @Field(() => Number, { nullable: true })
    frequencyMinutes?: number;

    @Field(() => String, { nullable: true, description: "Smart-Me device ID. If omitted, auto-discovered from the /Devices endpoint." })
    deviceId?: string;
}

@InputType()
export class CreateCalloutCronJobInput {
    @Field(() => String)
    calloutId: string;

    @Field(() => String)
    cronExpression: string;

    @Field(() => String, { nullable: true })
    sensorId?: string;

    @Field(() => String, { nullable: true })
    deviceId?: string;
}

@InputType()
export class UpdateCronJobInput {
    @Field(() => String)
    id: string;

    @Field(() => Boolean, { nullable: true })
    active?: boolean;

    @Field(() => Number, { nullable: true })
    frequencyMinutes?: number;

    @Field(() => String, { nullable: true })
    cronExpression?: string;
}

@Resolver()
export class CronJobResolver {
    @Query(() => [CronJobOutput])
    async cronJobs(@Ctx() ctx: types.GraphQLResolverContext): Promise<CronJobOutput[]> {
        const jobs = await ctx.storage.getCronJobs(ctx.user);
        return jobs.map(j => ({
            id: j.id,
            jobType: j.jobType,
            active: j.active,
            frequencyMinutes: j.frequencyMinutes,
            calloutId: j.calloutId,
            sensorId: j.sensorId,
            houseId: j.houseId,
            deviceId: j.deviceId,
            cronExpression: j.config?.cronExpression,
        }));
    }

    @Mutation(() => CronJobOutput, {
        description: "Creates a Smart-Me powermeter cron job with all necessary callout infrastructure",
    })
    async createSmartmeCronJob(
        @Arg("data") data: CreateSmartmeCronJobInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<CronJobOutput> {
        const sensor = await ctx.storage.getSensor(ctx.user, data.sensorId);
        const houseId = data.houseId;
        const frequency = data.frequencyMinutes || constants.DEFAULTS.CRONJOB.DEFAULT_FREQUENCY_MINUTES;
        const suffix = houseId.substring(0, 8);

        const endpoint = await ctx.storage.createCalloutEndpoint(ctx.user, {
            name: `smartme-${suffix}`,
            baseUrl: "https://api.smart-me.com",
        }, true);

        const clientIdSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-cid-${suffix}`,
            value: data.clientId,
        }, true);

        const clientSecretSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-cs-${suffix}`,
            value: data.clientSecret,
        }, true);

        const templateMappings: Array<{ name: string; secretId: string }> = [
            { name: "client_id", secretId: clientIdSecret.id },
            { name: "client_secret", secretId: clientSecretSecret.id },
        ];

        const scopeSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-scope-${suffix}`,
            value: "device.read",
        }, true);
        templateMappings.push({ name: "scope", secretId: scopeSecret.id });

        const authenticator = await ctx.storage.createCalloutAuthenticator(ctx.user, {
            name: `smartme-auth-${suffix}`,
            endpointId: endpoint.id,
            template: AuthenticatorTemplate.CLIENTCREDENTIALS_OAUTH,
            templateMappings,
        }, true);

        let smartmeDeviceId = data.deviceId;
        if (!smartmeDeviceId) {
            smartmeDeviceId = await this.discoverSmartmeDeviceId(data.clientId, data.clientSecret, endpoint.baseUrl);
        }

        const calloutId = uuid();
        await ctx.storage.createUserCallout(ctx.user, {
            id: calloutId,
            name: `smartme-poll-${suffix}`,
            endpointId: endpoint.id,
            authenticatorId: authenticator.id,
            method: types.HttpMethod.GET,
            pathTemplate: `/Devices/${smartmeDeviceId}`,
            headers: { accept: "application/json" },
        }, true);

        const job = await ctx.storage.createCronJob(ctx.user, {
            jobType: types.CronJobType.SMARTME_POWERMETER,
            frequencyMinutes: frequency,
            config: { smartmeDeviceId },
            calloutId,
            sensorId: sensor.id,
            houseId,
        });

        return {
            id: job.id,
            jobType: job.jobType,
            active: job.active,
            frequencyMinutes: job.frequencyMinutes,
            calloutId: job.calloutId,
            sensorId: job.sensorId,
            houseId: job.houseId,
        };
    }

    @Mutation(() => CronJobOutput, {
        description: "Creates a callout cron job that executes an existing callout on a schedule",
    })
    async createCalloutCronJob(
        @Arg("data") data: CreateCalloutCronJobInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<CronJobOutput> {
        if (!data.sensorId && !data.deviceId) {
            throw new Error("Either sensorId or deviceId must be provided");
        }
        if (data.sensorId && data.deviceId) {
            throw new Error("Provide either sensorId or deviceId, not both");
        }

        try {
            new Cron(data.cronExpression);
        } catch (err: any) {
            throw new Error(`Invalid cron expression: ${err.message}`);
        }

        const callout = await ctx.storage.getUserCallout(ctx.user, data.calloutId);
        if (!callout) {
            throw new Error(`Callout not found: ${data.calloutId}`);
        }

        const job = await ctx.storage.createCronJob(ctx.user, {
            jobType: types.CronJobType.CALLOUT,
            frequencyMinutes: 0,
            config: { cronExpression: data.cronExpression },
            calloutId: data.calloutId,
            sensorId: data.sensorId,
            deviceId: data.deviceId,
        });

        return {
            id: job.id,
            jobType: job.jobType,
            active: job.active,
            frequencyMinutes: job.frequencyMinutes,
            calloutId: job.calloutId,
            sensorId: job.sensorId,
            houseId: job.houseId,
            deviceId: job.deviceId,
            cronExpression: data.cronExpression,
        };
    }

    private async discoverSmartmeDeviceId(clientId: string, clientSecret: string, baseUrl: string): Promise<string> {
        const calloutSvc = getService<CalloutService>(CalloutService.NAME);

        const tokenResp = await calloutSvc.request<{ access_token: string }>({
            method: "POST",
            url: `${baseUrl}/oauth/token`,
            headers: { "content-type": MIMETYPE_FORM, "accept": MIMETYPE_JSON },
            body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=device.read`,
        });

        const devices = await calloutSvc.request<Array<{ Id: string; Name: string }>>({
            method: "GET",
            url: `${baseUrl}/Devices`,
            headers: { "Authorization": `Bearer ${tokenResp.access_token}`, "accept": MIMETYPE_JSON },
        });

        if (!devices || devices.length === 0) {
            throw new Error("No devices found on Smart-Me account. Please specify a device ID manually.");
        }

        return devices[0].Id;
    }

    @Mutation(() => CronJobOutput, {
        description: "Updates a cron job's active state, frequency, and/or cron expression",
    })
    async updateCronJob(
        @Arg("data") data: UpdateCronJobInput,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<CronJobOutput> {
        if (data.cronExpression) {
            try {
                new Cron(data.cronExpression);
            } catch (err: any) {
                throw new Error(`Invalid cron expression: ${err.message}`);
            }
        }

        let configUpdate: Record<string, any> | undefined;
        if (data.cronExpression) {
            const jobs = await ctx.storage.getCronJobs(ctx.user);
            const existing = jobs.find(j => j.id === data.id);
            if (existing) {
                configUpdate = { ...existing.config, cronExpression: data.cronExpression };
            }
        }

        const job = await ctx.storage.updateCronJob(ctx.user, data.id, {
            active: data.active,
            frequencyMinutes: data.frequencyMinutes,
            config: configUpdate,
        });
        return {
            id: job.id,
            jobType: job.jobType,
            active: job.active,
            frequencyMinutes: job.frequencyMinutes,
            calloutId: job.calloutId,
            sensorId: job.sensorId,
            houseId: job.houseId,
            deviceId: job.deviceId,
            cronExpression: job.config?.cronExpression,
        };
    }

    @Mutation(() => Boolean, {
        description: "Deletes a cron job and its associated system-managed callout infrastructure (for smartme jobs only)",
    })
    async deleteCronJob(
        @Arg("id") id: string,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<boolean> {
        const jobs = await ctx.storage.getCronJobs(ctx.user);
        const job = jobs.find(j => j.id === id);
        if (!job) throw new Error(`Cron job not found: ${id}`);

        if (job.jobType === types.CronJobType.SMARTME_POWERMETER && job.calloutId) {
            const callout = await ctx.storage.getUserCallout(ctx.user, job.calloutId);
            if (callout && callout.systemManaged) {
                const endpointId = callout.endpoint.id;
                const authenticator = callout.authenticator;

                let secretIds: string[] = [];
                if (authenticator) {
                    secretIds = Object.values(authenticator.templateMappings).map(s => s.id);
                    await ctx.storage.deleteCalloutAuthenticator(ctx.user, { id: authenticator.id }, true);
                }

                await ctx.storage.deleteCallout(ctx.user, { id: job.calloutId }, true);
                await ctx.storage.deleteCalloutEndpoint(ctx.user, { id: endpointId }, true);

                for (const secretId of secretIds) {
                    await ctx.storage.deleteCalloutSecret(ctx.user, { id: secretId }, true);
                }
            }
        }

        await ctx.storage.deleteCronJob(ctx.user, id);
        return true;
    }
}
