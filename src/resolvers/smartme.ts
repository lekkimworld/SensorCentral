import { Resolver, ObjectType, Field, Arg, InputType, Query, Mutation, Ctx } from "type-graphql";
import { Length } from "class-validator";
import * as types from "../types";
import constants from "../constants";
import moment from "moment-timezone";
import { House } from "./house";
import { Sensor } from "./sensor";
import CalloutService, { MIMETYPE_JSON } from "../services/callout-service";
import getService from "../services/service-locator";
import { AuthenticatorTemplate } from "../callout-authenticator-templates/templates";
import { v4 as uuid } from "uuid";

export class Cloudflare524Error extends Error {
    constructor(msg: string) {
        super(`Cloud Flare specific status 524 error - ${msg}`);
    }
}

export enum PowerUnit {
    "kW",
    "kWh",
    "Unknown",
}
const parsePowerUnit = (str: string): PowerUnit => {
    return str === "kW" ? PowerUnit.kW : str === "kWh" ? PowerUnit.kWh : PowerUnit.Unknown;
};

const SMARTME_BASE_URL = `${constants.SMARTME.PROTOCOL}://${constants.SMARTME.DOMAIN}`;

@ObjectType()
export class SmartmeDeviceWithDataType {
    @Field(() => String) id: string;
    @Field(() => String) name: string;
    @Field(() => Number) serial: number;
    @Field(() => Number) deviceEnergyType: number;
    @Field(() => Number) activePower: number;
    @Field(() => Number) activePowerUnit: PowerUnit;
    @Field(() => Number) counterReading: number;
    @Field(() => Number) counterReadingUnit: PowerUnit;
    @Field(() => Number) counterReadingT1: number;
    @Field(() => Number) counterReadingT2: number;
    @Field(() => Number) counterReadingT3: number;
    @Field(() => Number) counterReadingT4: number;
    @Field(() => Number) counterReadingImport: number;
    @Field(() => Number) counterReadingExport: number;
    @Field(() => Number) voltageL1: number;
    @Field(() => Number) voltageL2: number;
    @Field(() => Number) voltageL3: number;
    @Field(() => Number) currentL1: number;
    @Field(() => Number) currentL2: number;
    @Field(() => Number) currentL3: number;
    @Field(() => Date) valueDate: Date;

    constructor(data: any) {
        this.id = data.Id;
        this.name = data.Name;
        this.serial = data.Serial;
        this.deviceEnergyType = data.DeviceEnergyType;
        this.activePower = data.ActivePower;
        this.activePowerUnit = parsePowerUnit(data.ActivePowerUnit);
        this.counterReading = data.CounterReading;
        this.counterReadingUnit = parsePowerUnit(data.CounterReadingUnit);
        this.counterReadingT1 = data.CounterReadingT1;
        this.counterReadingT2 = data.CounterReadingT2;
        this.counterReadingT3 = data.CounterReadingT3;
        this.counterReadingT4 = data.CounterReadingT4;
        this.counterReadingImport = data.CounterReadingImport;
        this.counterReadingExport = data.CounterReadingExport;
        this.voltageL1 = data.VoltageL1;
        this.voltageL2 = data.VoltageL2;
        this.voltageL3 = data.VoltageL3;
        this.currentL1 = data.CurrentL1;
        this.currentL2 = data.CurrentL2;
        this.currentL3 = data.CurrentL3;
        this.valueDate = moment.utc(data.ValueDate, "YYYY-MM-DDTHH:mm:ss.SSSSSSSZ").toDate();
    }
}

@ObjectType()
export class SmartmeEnsureSubscriptionOutputType {
    @Field(() => String) houseId: string;
    @Field(() => String) sensorId: string;
    @Field(() => Number, { nullable: true, defaultValue: 1 }) frequency: number;
}

@InputType()
export class SmartmeEnsureSubscriptionInputType {
    @Field(() => String) houseId: string;
    @Field(() => String) sensorId: string;
    @Field(() => Number, { nullable: true, defaultValue: 1 }) frequency: number;
}

@ObjectType()
export class SmartmeSubscriptionType {
    @Field(() => House) house: House;
    @Field(() => Sensor) sensor: Sensor;
    @Field(() => Number) frequency: number;
    @Field(() => String) calloutId: string;
}

@InputType()
export class SmartmeCredentialsType {
    @Field(() => String)
    @Length(2, 128)
    clientId: string;

    @Field(() => String)
    @Length(2, 128)
    clientSecret: string;
}

@Resolver()
export class SmartmeResolver {
    @Query(() => Boolean, {})
    async smartmeVerifyCredentials(
        @Arg("data") data: SmartmeCredentialsType,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<Boolean> {
        const calloutSvc = getService<CalloutService>(CalloutService.NAME);

        // create temporary secrets/endpoint/authenticator to test credentials
        const endpoint = await ctx.storage.createCalloutEndpoint(ctx.user, {
            name: `smartme-verify-${uuid().substring(0, 8)}`,
            baseUrl: SMARTME_BASE_URL,
        });
        const clientIdSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-cid-${uuid().substring(0, 8)}`,
            value: data.clientId,
        });
        const clientSecretSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-cs-${uuid().substring(0, 8)}`,
            value: data.clientSecret,
        });
        const authenticator = await ctx.storage.createCalloutAuthenticator(ctx.user, {
            name: `smartme-auth-${uuid().substring(0, 8)}`,
            endpointId: endpoint.id,
            template: AuthenticatorTemplate.SMARTME_CLIENTCREDENTIALS,
            templateMappings: [
                { name: "client_id", secretId: clientIdSecret.id },
                { name: "client_secret", secretId: clientSecretSecret.id },
            ],
        });

        try {
            // try fetching /api/User to verify credentials work
            await calloutSvc.callout(ctx.user, {
                id: "verify-temp",
                name: "verify-temp",
                endpoint,
                authenticator: {
                    id: authenticator.id,
                    name: authenticator.name,
                    endpoint,
                    template: AuthenticatorTemplate.SMARTME_CLIENTCREDENTIALS,
                    templateMappings: {
                        client_id: clientIdSecret,
                        client_secret: clientSecretSecret,
                    },
                },
                method: types.HttpMethod.GET,
                pathTemplate: "/api/User",
                headers: { accept: "application/json" },
            }, undefined);
            return true;
        } catch {
            return false;
        } finally {
            // clean up temporary objects — deleting endpoint cascades to authenticator
            await ctx.storage.deleteCalloutEndpoint(ctx.user, { id: endpoint.id });
            await ctx.storage.deleteCalloutSecret(ctx.user, { id: clientIdSecret.id });
            await ctx.storage.deleteCalloutSecret(ctx.user, { id: clientSecretSecret.id });
        }
    }

    @Query(() => [SmartmeDeviceWithDataType], { nullable: false })
    async smartmeGetDevices(
        @Arg("data") data: SmartmeCredentialsType,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        const calloutSvc = getService<CalloutService>(CalloutService.NAME);

        // create temporary objects to make the callout
        const endpoint = await ctx.storage.createCalloutEndpoint(ctx.user, {
            name: `smartme-disc-${uuid().substring(0, 8)}`,
            baseUrl: SMARTME_BASE_URL,
        });
        const clientIdSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-cid-${uuid().substring(0, 8)}`,
            value: data.clientId,
        });
        const clientSecretSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-cs-${uuid().substring(0, 8)}`,
            value: data.clientSecret,
        });
        const authenticator = await ctx.storage.createCalloutAuthenticator(ctx.user, {
            name: `smartme-auth-${uuid().substring(0, 8)}`,
            endpointId: endpoint.id,
            template: AuthenticatorTemplate.SMARTME_CLIENTCREDENTIALS,
            templateMappings: [
                { name: "client_id", secretId: clientIdSecret.id },
                { name: "client_secret", secretId: clientSecretSecret.id },
            ],
        });

        try {
            const resultData = await calloutSvc.callout<any[]>(ctx.user, {
                id: "discover-temp",
                name: "discover-temp",
                endpoint,
                authenticator: {
                    id: authenticator.id,
                    name: authenticator.name,
                    endpoint,
                    template: AuthenticatorTemplate.SMARTME_CLIENTCREDENTIALS,
                    templateMappings: {
                        client_id: clientIdSecret,
                        client_secret: clientSecretSecret,
                    },
                },
                method: types.HttpMethod.GET,
                pathTemplate: "/api/Devices",
                headers: { accept: "application/json" },
            }, undefined);

            if (!resultData) return [];
            if (Array.isArray(resultData)) {
                return resultData.map((d: any) => new SmartmeDeviceWithDataType(d));
            }
            return [new SmartmeDeviceWithDataType(resultData)];
        } finally {
            await ctx.storage.deleteCalloutEndpoint(ctx.user, { id: endpoint.id });
            await ctx.storage.deleteCalloutSecret(ctx.user, { id: clientIdSecret.id });
            await ctx.storage.deleteCalloutSecret(ctx.user, { id: clientSecretSecret.id });
        }
    }

    @Mutation(() => SmartmeSubscriptionType, {
        description:
            "Creates callout secrets/endpoint/authenticator/callout for Smart-Me OAuth, then creates a powermeter subscription",
    })
    async smartmeEnsureSubscription(
        @Arg("credentials") creds: SmartmeCredentialsType,
        @Arg("subscription") subscription: SmartmeEnsureSubscriptionInputType,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        // get sensor (throws error if sensor cannot be found) to ensure access
        const sensor = await ctx.storage.getSensor(ctx.user, subscription.sensorId);
        const houseId = sensor.device!.house.id;

        // remove existing subscriptions if any
        await ctx.storage.removePowermeterSubscriptions(ctx.user, houseId);

        // create persistent callout infrastructure
        const endpoint = await ctx.storage.createCalloutEndpoint(ctx.user, {
            name: `smartme-${houseId.substring(0, 8)}`,
            baseUrl: SMARTME_BASE_URL,
        });

        const clientIdSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-cid-${houseId.substring(0, 8)}`,
            value: creds.clientId,
        });
        const clientSecretSecret = await ctx.storage.createCalloutSecret(ctx.user, {
            name: `smartme-cs-${houseId.substring(0, 8)}`,
            value: creds.clientSecret,
        });

        const authenticator = await ctx.storage.createCalloutAuthenticator(ctx.user, {
            name: `smartme-auth-${houseId.substring(0, 8)}`,
            endpointId: endpoint.id,
            template: AuthenticatorTemplate.SMARTME_CLIENTCREDENTIALS,
            templateMappings: [
                { name: "client_id", secretId: clientIdSecret.id },
                { name: "client_secret", secretId: clientSecretSecret.id },
            ],
        });

        // create the callout that fetches a specific device by sensorId
        const calloutId = uuid();
        await ctx.storage.createUserCallout(ctx.user, {
            id: calloutId,
            name: `smartme-poll-${houseId.substring(0, 8)}`,
            endpointId: endpoint.id,
            authenticatorId: authenticator.id,
            method: types.HttpMethod.GET,
            pathTemplate: "/api/Devices/{{sensorId}}",
            headers: { accept: "application/json" },
        });

        // create the subscription
        await ctx.storage.createPowermeterSubscription(
            ctx.user,
            houseId,
            sensor.id,
            subscription.frequency,
            calloutId
        );

        return {
            house: sensor.device!.house,
            sensor,
            frequency: subscription.frequency,
            calloutId,
        } as SmartmeSubscriptionType;
    }

    @Mutation(() => Boolean, {
        description: "Given a house ID will remove all powermeter subscriptions for that house",
    })
    async smartmeRemoveSubscription(@Arg("houseId") houseId: string, @Ctx() ctx: types.GraphQLResolverContext) {
        // remove existing subscriptions if any (will also check access)
        await ctx.storage.removePowermeterSubscriptions(ctx.user, houseId);
        return true;
    }

    @Query(() => [SmartmeEnsureSubscriptionOutputType], {
        description: "Returns the current subscriptions we have for powermeter data for the houses the user has access to",
    })
    async smartmeGetSubscriptions(@Ctx() ctx: types.GraphQLResolverContext) {
        return (await ctx.storage.getPowermeterSubscriptions(ctx.user)).map((sub) => {
            return {
                sensorId: sub.sensor.id,
                houseId: sub.house.id,
                frequency: sub.frequency,
            } as SmartmeEnsureSubscriptionOutputType;
        });
    }
}
