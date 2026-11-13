import { Injectable, ServiceUnavailableException } from '@nestjs/common';
@Injectable()
export class SmsService {
  async sendVerificationCode(to: string, code: string) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) throw new ServiceUnavailableException('SMS delivery is not configured. Configure the SMS provider before requesting phone verification.');
    const body = new URLSearchParams({ To: to, From: from, Body: `Your Trueman Logistics verification code is ${code}. It expires in five minutes. Never share this code.` });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) throw new ServiceUnavailableException('The SMS provider could not deliver the verification message.');
  }
}
