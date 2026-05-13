import { BaseService } from "../types";
import nodemailer from "nodemailer";
import { Logger } from "../logger";

const logger = new Logger("email-service");

export class RFC822Address {
    constructor(name: string, email: string) {
        this.email = email;
        this.name = name;
    }
    email: string;
    name: string;

    toString() {
        if (this.name && this.email) {
            return `${this.name} <${this.email}>`;
        }
        return this.email;
    }
}

export class EmailMessage {
    from: string | RFC822Address;
    to: string | RFC822Address;
    subject: string;
    body: string;
}

export class EmailService extends BaseService {
    public static NAME = "email";
    private transporter: nodemailer.Transporter | undefined;

    constructor() {
        super(EmailService.NAME);
        if (process.env.SMTP_HOST) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === "true",
                auth: process.env.SMTP_USER ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                } : undefined,
            });
            logger.info("SMTP configured");
        } else {
            logger.warn("SMTP_HOST not set - email sending disabled");
        }
    }

    async send(msg: EmailMessage) {
        if (!this.transporter) {
            logger.warn(`Email not sent (SMTP not configured) - subject <${msg.subject}>`);
            return;
        }

        const from = typeof msg.from === "string" ? msg.from : msg.from.toString();
        const to = typeof msg.to === "string" ? msg.to : msg.to.toString();

        try {
            const info = await this.transporter.sendMail({
                from: process.env.SMTP_FROM || from,
                to,
                subject: msg.subject,
                text: msg.body,
            });
            logger.info(`Sent email - messageId <${info.messageId}>`);
        } catch (err) {
            logger.error(`Failed to send email`, err);
            throw err;
        }
    }
}