import { BaseService } from "../types";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import moment from "moment";
import constants from "../constants";
import { Logger } from "../logger";

const logger = new Logger("email-service");

const GOOGLE_PRIVATE_KEY = constants.GOOGLE.PRIVATE_KEY;
const GOOGLE_SCOPES = constants.GOOGLE.SCOPES.join(" ");
const GOOGLE_EXPIRATION_MINUTES = constants.GOOGLE.JWT_EXPIRATION_MINUTES;
const AUDIENCE = constants.GOOGLE.TOKEN_URI;
const ISSUER = constants.GOOGLE.SERVICE_ACCOUNT_EMAIL;

export class RFC822Address {
    constructor(name : string, email : string) {
        this.email = email;
        this.name = name;
    }
    email : string;
    name : string;

    toString() {
        if (this.name && this.email) {
            return `${this.name} <${this.email}>`;
        }
    }
}

export class EmailMessage {
    from : string | RFC822Address;
    to : string | RFC822Address;
    subject : string;
    body : string;

    toString() {
        const date = moment().format("ddd, D MMM YYYY HH:mm:ss ZZ");
        return `From: ${typeof this.from === "string" ? this.from : this.from.toString()}
To: ${typeof this.to === "string" ? this.to : this.to.toString()}
Subject: ${this.subject}
Date: ${date} 
Message-ID: <${new Date().getTime()}@local.machine.example>

${this.body}`
    }

    toBase64() {
        const s = this.toString();
        return Buffer.from(s).toString("base64");
    }
}

export class EmailService extends BaseService {
    public static NAME = "email";
    constructor() {
        super(EmailService.NAME);
    }

    async send(msg : EmailMessage) {
        // create JWT
        const token = await jwt.sign({
            "scope": GOOGLE_SCOPES,
            "exp": Math.floor(new Date().getTime()/1000) + (GOOGLE_EXPIRATION_MINUTES*60)
        }, GOOGLE_PRIVATE_KEY, {
            "algorithm": "RS256",
            "issuer": ISSUER,
            "audience": AUDIENCE,
            "subject": typeof msg.from === "string" ? msg.from : (msg.from as RFC822Address).email
        });
        
        // exchange JWT for access token
        let res = await fetch(process.env.GOOGLE_TOKEN_URI as  string, {
            "method": "post",
            "headers": {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            "body": `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
        });
        const body_token = await res.json();
        const access_token = body_token.access_token;

        // send email
        res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
            "method": "post",
            "headers": {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`
            },
            "body": JSON.stringify({
                "raw": msg.toBase64()
            })
        });
        const send_body = await res.json();
        if (send_body.labelIds && send_body.labelIds[0] === "SENT") {
            logger.info(`Sent e-mail - id <${send_body.id}> thread <${send_body.threadId}>`);
        } else {
            logger.info(JSON.stringify(send_body));
        }
    }
}