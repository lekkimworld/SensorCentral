import { IsEnum } from "class-validator";
import { Field, InputType } from "type-graphql";
import constants, { ISO8601_DATETIME_FORMAT } from "../../constants";
import * as types from "../../types";
import { IEnsureDefaults } from "./dataquery-service";

@InputType()
export class PowerConsumptionQueryFilterInput {
    @Field({ nullable: false, description: "The sensor ID of the power meter" })
    id: string;

    @Field({ nullable: false, description: "Start date/time in ISO8601 format" })
    start: Date;

    @Field({ nullable: false, description: "End date/time in ISO8601 format" })
    end: Date;
}

@InputType()
export class PowerConsumptionQueryFormatInput implements IEnsureDefaults {
    @Field({
        nullable: true,
        description: "The timezone for the date/time information in the x-field of the dataset",
        defaultValue: constants.DEFAULTS.TIMEZONE,
    })
    timezone: string;

    ensureDefaults() {
        if (!Object.prototype.hasOwnProperty.call(this, "timezone")) {
            this.timezone = constants.DEFAULTS.TIMEZONE;
        }
    }
}

@InputType()
export class PowerDataQueryFilterInput {
    @Field({ nullable: false, description: "The sensor ID of the power meter" })
    id: string;

    @Field(() => types.PowerPhase, { nullable: false, description: "The phase you are querying for" })
    @IsEnum(types.PowerPhase)
    phase: types.PowerPhase;

    @Field(() => types.PowerType, { nullable: false, description: "The type of data you are querying for" })
    @IsEnum(types.PowerType)
    type: types.PowerType;

    @Field({ nullable: false, description: "Start date/time in ISO8601 format" })
    start: Date;

    @Field({ nullable: false, description: "End date/time in ISO8601 format" })
    end: Date;
}

@InputType()
export class PowerDataQueryFormatInput implements IEnsureDefaults {
    @Field({
        nullable: true,
        description:
            "The format for date/time information in the x-field of the dataset (default: " +
            ISO8601_DATETIME_FORMAT +
            ")",
    })
    format: string;

    @Field({
        nullable: true,
        description: "The timezone for the date/time information in the x-field of the dataset",
        defaultValue: constants.DEFAULTS.TIMEZONE,
    })
    timezone: string;

    @Field({ nullable: true, description: "Sort ascending (true) or descending (false)", defaultValue: true })
    sortAscending: true;

    ensureDefaults() {
        if (!Object.prototype.hasOwnProperty.call(this, "timezone")) {
            this.timezone = constants.DEFAULTS.TIMEZONE;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "format")) {
            this.format = ISO8601_DATETIME_FORMAT;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "sortAscending")) {
            this.sortAscending = true;
        }
    }
}
