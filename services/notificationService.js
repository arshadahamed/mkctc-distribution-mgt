const nodemailer = require('nodemailer');
const settingsRepo = require('../repositories/settingsRepo');

class NotificationService {
    constructor() {
        this.emailTransporter = null;
    }

    async getEmailTransporter() {
        if (this.emailTransporter) return this.emailTransporter;

        const enabled = await settingsRepo.getSetting('email_enabled');
        if (enabled !== 'true' && enabled !== true) return null;

        const host = await settingsRepo.getSetting('email_host');
        const port = await settingsRepo.getSetting('email_port');
        const user = await settingsRepo.getSetting('email_user');
        const pass = await settingsRepo.getSetting('email_pass');

        if (!host || !user || !pass) {
            console.error('Email configuration incomplete');
            return null;
        }

        this.emailTransporter = nodemailer.createTransport({
            host,
            port: parseInt(port) || 587,
            secure: port == 465,
            auth: { user, pass }
        });

        return this.emailTransporter;
    }

    async sendEmail(to, subject, html) {
        try {
            const transporter = await this.getEmailTransporter();
            if (!transporter) return false;

            const from = await settingsRepo.getSetting('email_from') || 'support@mkc.com';

            const info = await transporter.sendMail({
                from,
                to,
                subject,
                html
            });

            console.log('Email sent: %s', info.messageId);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    }

    async sendSMS(phoneNumber, message) {
        try {
            const enabled = await settingsRepo.getSetting('sms_enabled');
            if (enabled !== 'true' && enabled !== true) return false;

            const provider = await settingsRepo.getSetting('sms_provider') || 'textbelt';
            const apiKey = await settingsRepo.getSetting('sms_api_key');

            if (provider === 'textbelt') {
                return await this.sendTextbeltSMS(phoneNumber, message, apiKey);
            } else if (provider === 'twilio') {
                const sid = await settingsRepo.getSetting('sms_twilio_sid');
                const token = await settingsRepo.getSetting('sms_twilio_token');
                const from = await settingsRepo.getSetting('sms_twilio_from');
                return await this.sendTwilioSMS(phoneNumber, message, sid, token, from);
            } else if (provider === 'generic_webhook') {
                return await this.sendGenericWebhookSMS(phoneNumber, message, apiKey);
            }

            console.error('Unsupported SMS provider:', provider);
            return false;
        } catch (error) {
            console.error('Error sending SMS:', error);
            return false;
        }
    }

    async sendTwilioSMS(to, message, sid, token, from) {
        try {
            const auth = Buffer.from(`${sid}:${token}`).toString('base64');

            // Check if 'from' is a Messaging Service SID (starts with MG) or a Phone Number
            const params = {
                To: to,
                Body: message
            };

            if (from && from.startsWith('MG')) {
                params.MessagingServiceSid = from;
            } else {
                params.From = from;
            }

            const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams(params)
            });
            const data = await response.json();
            if (!response.ok) {
                console.error('Twilio Error:', data);
                return false;
            }
            console.log('Twilio success:', data.sid);
            return true;
        } catch (error) {
            console.error('Twilio request failed:', error);
            return false;
        }
    }

    async sendTextbeltSMS(phoneNumber, message, apiKey) {
        try {
            const response = await fetch('https://textbelt.com/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    number: phoneNumber,
                    message: message,
                    key: apiKey || 'textbelt', // 'textbelt' uses free tier (1/day)
                }),
            });
            const data = await response.json();
            console.log('Textbelt response:', data);
            return data.success;
        } catch (error) {
            console.error('Textbelt error:', error);
            return false;
        }
    }

    async sendGenericWebhookSMS(phoneNumber, message, webhookUrl) {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: phoneNumber,
                    message: message
                }),
            });
            return response.ok;
        } catch (error) {
            console.error('Generic Webhook SMS error:', error);
            return false;
        }
    }

    // Helper to format Invoice Email
    formatInvoiceEmail(invoice, company) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #2E7D32;">Invoice Received</h2>
                <p>Dear ${invoice.customer_name},</p>
                <p>Thank you for your purchase. Here is a summary of your invoice:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Invoice #:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${invoice.invoice_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${invoice.invoice_date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total Amount:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">LKR ${parseFloat(invoice.net_total).toLocaleString()}</td>
                    </tr>
                </table>
                <p>Regards,<br>${company.company_name || 'Agro Distribution'}</p>
            </div>
        `;
    }

    // Helper to format Receipt Email
    formatReceiptEmail(receipt, company) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #2E7D32;">Payment Received</h2>
                <p>Dear ${receipt.customer_name},</p>
                <p>We have received your payment. Here are the details:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Receipt #:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${receipt.receipt_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${receipt.receipt_date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount Paid:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">LKR ${parseFloat(receipt.amount).toLocaleString()}</td>
                    </tr>
                </table>
                <p>Regards,<br>${company.company_name || 'Agro Distribution'}</p>
            </div>
        `;
    }
}

module.exports = new NotificationService();
