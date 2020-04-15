import { Application } from "express";
import "reflect-metadata";
import { ApolloServer } from "apollo-server-express";
import { buildSchema, Resolver, Query, ObjectType, Field, ID, Arg, Mutation, InputType } from "type-graphql";
import ensureAuthenticated from "./middleware/ensureAuthenticated";
import * as types from "./types";
//@ts-ignore
import { lookupService } from "./configure-services";
import { StorageService } from "./services/storage-service";
import { IsEnum, Length } from "class-validator";
import constants from "./constants";

const path = process.env.GRAPHQL_PATH || "/graphql";

@ObjectType()
class House implements types.House {
    constructor(h : types.House) {
        this.id=h.id;
        this.name=h.name;
    }
    @Field(() => ID)
    id : string;

    @Field()
    name : string;
}

@InputType()
class DeviceInput {
    @Field({description: "One of \"yes\", \"no\", \"muted\""})
    @IsEnum(types.WatchdogNotification)
    notify: types.WatchdogNotification;

    @Field({description: "A valid device ID"})
    @Length(2)
    deviceId: string;
}

@ObjectType()
class Device implements types.Device {
    constructor(d : types.Device) {
        this.id = d.id;
        this.name = d.name;
        this.house = d.house;
        this.mutedUntil = d.mutedUntil;
        this.notify = d.notify;
    }

    @Field(() => ID)
    id : string;

    @Field()
    name : string;

    @Field(() => Date, {nullable: true})
    mutedUntil : Date | undefined;

    @Field()
    notify : types.WatchdogNotification;

    @Field()
    house : House;
}

@ObjectType()
class Sensor implements types.Sensor {
    constructor(s : types.Sensor) {
        this.id = s.id;
        this.name = s.name;
        this.label = s.label;
        this.type = s.type;
        this.deviceId = s.deviceId;
        this.device = s.device;
    }

    @Field(() => ID)
    id : string;

    @Field()
    name : string;

    @Field()
    label : string;

    @Field(() => String)
    type : types.SensorType | undefined;

    @Field(() => ID)
    deviceId : string;

    @Field(() => Device)
    device : types.Device | undefined;
}

@Resolver()
class HouseResolver {
    @Query(() => [House], { description: "Says hello to lekkim", nullable: false })
    async houses() {
        const storage = await lookupService("storage") as StorageService;
        const houses = storage.getHouses();
        return (await houses).map(h => new House(h));
    }

    @Query(() => House!, { description: "Returns the House with the supplied ID" })
    async house(@Arg("id") id : string) {
        const storage = await lookupService("storage") as StorageService;
        const houses = await (await storage.getHouses()).filter(h => h.id === id);
        return houses.length ? houses[0] : [];
    }
}

@Resolver()
class DeviceResolver {
    @Query(() => [Device], {})
    async devices(@Arg("houseId") houseId : string) {
        const storage = await lookupService("storage") as StorageService;
        const devices = await storage.getDevices();
        return devices.filter(d => d.house.id === houseId).map(d => new Device(d));
    }

    @Query(() => Device!, {})
    async device(@Arg("id") id : string) {
        const storage = await lookupService("storage") as StorageService;
        const device = await storage.getDeviceById(id);
        return device;
    }

    @Mutation(() => Device)
    async updateDevice(@Arg("data") {notify, deviceId} : DeviceInput) {
        const storage = await lookupService("storage") as StorageService;
        const device = await storage.getDeviceById(deviceId);
        const updatedDevice = await storage.updateDeviceNotificationState(device, notify);
        return new Device(updatedDevice);
    }
}

@Resolver()
class SensorResolver {
    @Query(() => [Sensor], {})
    async sensors(@Arg("deviceId") deviceId : string) {
        const storage = await lookupService("storage") as StorageService;
        const sensors = await storage.getSensors(deviceId);
        return sensors.map(s => new Sensor(s));
    }
}

export default async (app : Application) => {
    // attach a middleware to the graphql path to ensure user is authenticated 
    // either with a session or a JWT
    app.use(path, ensureAuthenticated);

    // define schema
    const schema = await buildSchema({
        resolvers: [HouseResolver, DeviceResolver, SensorResolver]
    })

    // see if we should enable playground
    const enablePlayground = constants.DEFAULTS.GRAPHQL_ENABLE_PLAYGROUND;
    if (enablePlayground) {
        console.log("Enabling GraphQL Playground");
    }
    const apolloServer = new ApolloServer({
        schema,
        "introspection": enablePlayground,
        "playground": enablePlayground
    });

    // attach the middleware to the app
    apolloServer.applyMiddleware({
        "path": path,
        "app": app
    });
    console.log(`Applied middleware from Apollo at path ${path}`);
}
