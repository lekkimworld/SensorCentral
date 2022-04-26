//@ts-ignore
import aes256 from "aes256";
import crypto from "crypto";
import constants from "./constants";

const PAYLOAD_SEPARATOR = ":";
const SIGNATURE_ALGORITHM = "sha256";

export class SmartmeCredentialsSignatureData {
    readonly username: string;
    readonly password: string;

    constructor(cleartext_payload: string) {
        const parts = cleartext_payload.split(PAYLOAD_SEPARATOR);
        this.username = parts[0];
        this.password = parts[1];
    }
}
export class SmartmeRealtimeSubscriptionSignatureData extends SmartmeCredentialsSignatureData{
    readonly deviceId: string;
    readonly sensorId: string;

    constructor(cleartext_payload: string) {
        super(cleartext_payload);
        const parts = cleartext_payload.split(PAYLOAD_SEPARATOR);
        if (parts.length >= 3) {
            this.deviceId = parts[3];
            this.sensorId = parts[4];
        }
    }
}

export const generatePayload = (username: string, password: string, deviceId? : string, sensorId? : string) => {
    let payload = `${username}${PAYLOAD_SEPARATOR}${password}`;
    if (deviceId) {
        payload = `${payload}${PAYLOAD_SEPARATOR}${deviceId}`;
    }
    if (sensorId) {
        payload = `${payload}${PAYLOAD_SEPARATOR}${sensorId}`;
    }
    const cipher_payload = aes256.encrypt(constants.SMARTME.ENCRYPTION_KEY, payload);
    const signature = crypto
        .createHmac(SIGNATURE_ALGORITHM, constants.SMARTME.ENCRYPTION_KEY)
        .update(cipher_payload)
        .digest("base64");
    const result = `${cipher_payload}.${signature}`;
    return result;
};

export const verifyPayload = (input: string): SmartmeCredentialsSignatureData => {
    // verify and decrypt
    if (!input) throw Error("No or invalid input supplied");
    const idx = input.indexOf(".");
    if (idx < 0) throw Error("Invalid input format - missing signature");
    const payload = input.substring(0, idx);
    const signature = input.substring(idx + 1);

    // calculate signature over payload
    const calc_signature = crypto
        .createHmac(SIGNATURE_ALGORITHM, constants.SMARTME.ENCRYPTION_KEY)
        .update(payload)
        .digest("base64");
    if (signature !== calc_signature) {
        throw Error("Signature doesn't match");
    }

    // decrypt
    const cleartext = aes256.decrypt(constants.SMARTME.ENCRYPTION_KEY, payload);
    const result = new SmartmeRealtimeSubscriptionSignatureData(cleartext);
    return result;
};
