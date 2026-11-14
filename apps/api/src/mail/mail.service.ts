import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import nodemailer = require("nodemailer");

@Injectable()
export class MailService {
  private transporter: ReturnType<typeof nodemailer.createTransport> | null =
    null;

  private getTransporter() {
    const host = process.env.SMTP_HOST;
    if (!host)
      throw new ServiceUnavailableException(
        "Email delivery is not configured. Configure SMTP before requesting verification.",
      );
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: process.env.SMTP_SECURE === "true",
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 20_000,
        ...(process.env.SMTP_USER
          ? {
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD ?? "",
              },
            }
          : {}),
      });
    }
    return this.transporter;
  }

  private messageId(idempotencyKey: string) {
    const digest = createHash("sha256").update(idempotencyKey).digest("hex");
    return `<${digest}@trueman.local>`;
  }

  async sendVerificationCode(
    to: string,
    code: string,
    purpose: "verify" | "reset",
  ) {
    const transporter = this.getTransporter();
    const subject =
      purpose === "verify"
        ? "Verify your Trueman Logistics account"
        : "Reset your Trueman Logistics password";
    await transporter.sendMail({
      from:
        process.env.MAIL_FROM ?? "Trueman Logistics <no-reply@trueman.local>",
      to,
      subject,
      text: `Your verification code is ${code}. It expires in five minutes. If you did not request this, ignore this email.`,
      html: `<p>Your Trueman Logistics verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in five minutes. Never share this code.</p>`,
    });
  }

  async sendQuotationReady(
    to: string,
    quoteNumber: string,
    destination: string,
    amount: string,
    validUntil: Date,
    idempotencyKey: string,
  ) {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from:
        process.env.MAIL_FROM ?? "Trueman Logistics <no-reply@trueman.local>",
      to,
      messageId: this.messageId(idempotencyKey),
      subject: `Your Trueman Logistics quotation ${quoteNumber} is ready`,
      text: [
        "Your shipping quotation is ready to review in your Trueman Logistics customer account.",
        "",
        `Reference: ${quoteNumber}`,
        `Destination: ${destination}`,
        `Total: ${amount}`,
        `Valid until: ${validUntil.toISOString().slice(0, 10)}`,
        "",
        "Sign in to review the quotation and decide whether to accept it.",
      ].join("\n"),
    });
  }

  async sendQuoteRequestReceived(
    to: string,
    requestNumber: string,
    destination: string,
    mode: string,
    idempotencyKey: string,
  ) {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from:
        process.env.MAIL_FROM ?? "Trueman Logistics <no-reply@trueman.local>",
      to,
      messageId: this.messageId(idempotencyKey),
      subject: `We received quotation request ${requestNumber}`,
      text: [
        "Your shipment quotation request has been received.",
        "Our team will review the shipment details, calculate a quotation, and email you when it is ready.",
        "",
        `Request reference: ${requestNumber}`,
        `Shipping method: ${mode}`,
        `Destination: ${destination}`,
        "",
        "You can also check its status in your Trueman Logistics customer account.",
      ].join("\n"),
    });
  }
}
