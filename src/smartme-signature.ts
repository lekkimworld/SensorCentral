//@ts-ignore
import aes256 from "aes256";
import crypto from "crypto";
import constants from "./constants";

const ENCODING_BASE64 = "base64";

export class InvalidSignatureError extends Error {
    constructor(msg : string) {
        super(msg);
    }
}

export class InvalidInputError extends Error {
    constructor(msg: string) {
        super(msg);
    }
}

export class SmartmeCredentialsSignatureData {
    readonly username: string;
    readonly password: string;

    constructor(cleartext_payload: string) {
        const parts = cleartext_payload.split(constants.SMARTME.PAYLOAD_SEPARATOR);
        this.username = parts[0];
        this.password = parts[1];
    }
}
export class SmartmeRealtimeSubscriptionSignatureData extends SmartmeCredentialsSignatureData{
    readonly deviceId: string;
    readonly sensorId: string;

    constructor(cleartext_payload: string) {
        super(cleartext_payload);
        const parts = cleartext_payload.split(constants.SMARTME.PAYLOAD_SEPARATOR);
        if (parts.length >= 3) {
            this.deviceId = parts[3];
            this.sensorId = parts[4];
        }
    }
}

export const generatePayload = (username: string, password: string, deviceId : string, sensorId : string) => {
    let payload = `${username}${constants.SMARTME.PAYLOAD_SEPARATOR}${password}`;
    if (deviceId) {
        payload = `${payload}${constants.SMARTME.PAYLOAD_SEPARATOR}${deviceId}`;
    }
    if (sensorId) {
        payload = `${payload}${constants.SMARTME.PAYLOAD_SEPARATOR}${sensorId}`;
    }
    const cipher_payload = aes256.encrypt(constants.SMARTME.ENCRYPTION_KEY, payload);
    const signature = crypto
        .createHmac(constants.SMARTME.SIGNATURE_ALGORITHM, constants.SMARTME.ENCRYPTION_KEY)
        .update(cipher_payload)
        .digest(ENCODING_BASE64);
    const result = `${cipher_payload}.${signature}`;
    return result;
};

/**
 * Verifies that the input has the correct format and returns a SmartmeCredentialsSignatureData 
 * instance once the signature has been verified.
 * 
 * @param input 
 * @returns 
 * @throws InvalidInputError
 * @throws InvalidSignatureError
 */
export const verifyPayload = (input: string): SmartmeCredentialsSignatureData => {
    // verify and decrypt
    if (!input) throw Error("No or invalid input supplied");
    const match_result = input.match(/^([=/,+a-z0-9]+)\.([=/,+a-z0-9]+)$/i);
    if (!match_result) throw new InvalidInputError("Invalid input format - missing signature");
    const payload = match_result[1];
    const signature = match_result[2];

    // calculate signature over payload
    const calc_signature = crypto
        .createHmac(constants.SMARTME.SIGNATURE_ALGORITHM, constants.SMARTME.ENCRYPTION_KEY)
        .update(payload)
        .digest(ENCODING_BASE64);
    if (signature !== calc_signature) {
        throw new InvalidSignatureError("Signature doesn't match");
    }

    // decrypt
    const cleartext = aes256.decrypt(constants.SMARTME.ENCRYPTION_KEY, payload);
    const result = new SmartmeRealtimeSubscriptionSignatureData(cleartext);
    return result;
};
