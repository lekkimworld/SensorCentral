//@ts-ignore
import aes256 from "aes256";
import crypto from "crypto";
import constants from "./constants";

const PAYLOAD_SEPARATOR = ":";

export class SmartmeSignatureData {
    readonly username : string;
    readonly password : string;
    readonly deviceId : string;
    readonly sensorId : string;

    constructor(cleartext_payload : string) {
        const parts = cleartext_payload.split(PAYLOAD_SEPARATOR);
        this.username = parts[0];
        this.password = parts[1];
        this.deviceId = parts[2];
        this.sensorId = parts[3];
    }
}

export const generatePayload = (username : string, password : string, deviceId : string, sensorId : string) => {
    const payload = `${username}${PAYLOAD_SEPARATOR}${password}${PAYLOAD_SEPARATOR}${deviceId}${PAYLOAD_SEPARATOR}${sensorId}`;
    const cipher_payload = aes256.encrypt(constants.SMARTME.ENCRYPTION_KEY, payload);
    const signature = crypto.createHmac("sha256", constants.SMARTME.ENCRYPTION_KEY).update(cipher_payload).digest("base64");
    const result = `${cipher_payload}.${signature}`;
    return result;
}

export const verifyPayload = (input : string) : SmartmeSignatureData => {
    // verify and decrypt
    if (!input) throw Error("Invalid input supplied");
    const idx = input.indexOf(".");
    if (idx < 0) throw Error("Invalid input format");
    const payload = input.substring(0, idx);
    const signature = input.substring(idx + 1);

    // calculate signature over payload
    const calc_signature = crypto.createHmac("sha256", constants.SMARTME.ENCRYPTION_KEY).update(payload).digest("base64");
    if (signature !== calc_signature) {
        throw Error("Signature doesn't match");
    }

    // decrypt
    const cleartext = aes256.decrypt(constants.SMARTME.ENCRYPTION_KEY, payload);
    const result = new SmartmeSignatureData(cleartext);
    return result;
}
