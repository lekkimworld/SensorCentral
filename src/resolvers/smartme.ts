import { Resolver, ObjectType, Field, Arg, InputType, Mutation } from "type-graphql";
import { generatePayload } from "../smartme-signature";
import { Length } from "class-validator";
import constants from "../constants";

@ObjectType()
export class SmartmeSubscription {
    constructor(username : string, password : string, deviceId : string, sensorId : string) {
        this.payload = generatePayload(username, password, deviceId, sensorId);
        this.url = `${constants.APP.PROTOCOL}://${constants.APP.DOMAIN}/smartme/${this.payload}`
    }

    @Field()
    payload : string;

    @Field()
    url : string;
}

@InputType()
export class CreateSmartmeSubscriptionType {
    @Field()
    @Length(2, 128)
    sensorId : string;

    @Field()
    @Length(2, 128)
    deviceId : string;

    @Field()
    @Length(2, 128)
    username : string;

    @Field()
    @Length(2, 128)
    password : string;
}

@Resolver()
export class SmartmeResolver {
    
    @Mutation(() => SmartmeSubscription)
    async createSmartmeSubscription(@Arg("data") data : CreateSmartmeSubscriptionType) {
        return new SmartmeSubscription(data.username, data.password, data.deviceId, data.sensorId);
    }

}
