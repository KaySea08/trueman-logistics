import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer = require('nodemailer');

@Injectable()
export class MailService {
  async sendVerificationCode(to: string, code: string, purpose: 'verify' | 'reset') {
    const host = process.env.SMTP_HOST;
    if (!host) throw new ServiceUnavailableException('Email delivery is not configured. Configure SMTP before requesting verification.');
    const transporter = nodemailer.createTransport({
      host, port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' } } : {}),
    });
    const subject = purpose === 'verify' ? 'Verify your Trueman Logistics account' : 'Reset your Trueman Logistics password';
    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'Trueman Logistics <no-reply@trueman.local>', to, subject,
      text: `Your verification code is ${code}. It expires in five minutes. If you did not request this, ignore this email.`,
      html: `<p>Your Trueman Logistics verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in five minutes. Never share this code.</p>`,
    });
  }
}
