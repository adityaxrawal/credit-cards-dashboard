import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/infrastructure/logger';
import dayjs from 'dayjs';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}

export class EmailService {
    private static transporter: nodemailer.Transporter;
    private static isConfigured = false;

    /**
     * Initialize SMTP transporter
     */
    static initialize() {
        if (this.transporter) return;

        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

        if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
            logger.warn('[EmailService] SMTP configuration missing. Email sending disabled.');
            this.isConfigured = false;
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT || '587'),
            secure: SMTP_SECURE === 'true',
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            }
        });

        this.isConfigured = true;
        logger.info('[EmailService] SMTP Transport initialized');
    }

    /**
     * Send email with retry logic
     */
    static async sendEmail(options: EmailOptions, retries = 3): Promise<boolean> {
        if (!this.isConfigured) {
            this.initialize();
            if (!this.isConfigured) {
                logger.warn('[EmailService] Email not sent - Service not configured', { to: options.to, subject: options.subject });
                return false;
            }
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || '"Financial Tracker" <noreply@financialtracker.com>',
            to: options.to,
            subject: options.subject,
            html: options.html
        };

        let attempt = 0;
        while (attempt < retries) {
            try {
                attempt++;
                await this.transporter.sendMail(mailOptions);
                logger.info(`[EmailService] Email sent successfully to ${options.to}`);
                return true;
            } catch (error: any) {
                logger.error(`[EmailService] Failed to send email (Attempt ${attempt}/${retries})`, error);
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
                }
            }
        }

        return false;
    }

    /**
     * Load and compile template
     */
    private static loadTemplate(templateName: string, data: Record<string, string>): string {
        try {
            const templatesDir = path.join(__dirname, '../../templates/email');
            const baseTemplate = fs.readFileSync(path.join(templatesDir, 'base.html'), 'utf-8');
            const contentTemplate = fs.readFileSync(path.join(templatesDir, `${templateName}.html`), 'utf-8');

            // Replace placeholders in content
            let content = contentTemplate;
            for (const [key, value] of Object.entries(data)) {
                content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }

            // Insert content into base template
            let emailHtml = baseTemplate.replace('{{content}}', content);
            emailHtml = emailHtml.replace('{{year}}', new Date().getFullYear().toString());

            return emailHtml;
        } catch (error) {
            logger.error('[EmailService] Template loading error', error);
            return '<p>Error loading email template.</p>';
        }
    }

    /**
     * Send Large Transaction Alert
     */
    static async sendLargeTransactionAlert(
        to: string,
        data: {
            amount: number;
            merchant: string;
            date: Date;
            threshold: number;
        }
    ): Promise<boolean> {
        const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        const formattedData = {
            amount: `₹${data.amount.toLocaleString('en-IN')}`,
            merchant: data.merchant,
            date: dayjs(data.date).format('D MMM YYYY, h:mm A'),
            threshold: `₹${data.threshold.toLocaleString('en-IN')}`,
            dashboardUrl: `${dashboardUrl}/transactions`
        };

        const html = this.loadTemplate('large-transaction', formattedData);
        return this.sendEmail({
            to,
            subject: `Alert: Large Transaction of ${formattedData.amount} detected`,
            html
        });
    }

    /**
     * Send Budget Alert
     */
    static async sendBudgetAlert(
        to: string,
        data: {
            month: number;
            year: number;
            monthlyBudget: number;
            spent: number;
            status: string;
        }
    ): Promise<boolean> {
        const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const percentage = ((data.spent / data.monthlyBudget) * 100).toFixed(1);
        const statusColor = data.status === 'exceeded' ? '#dc2626' : (data.status === 'critical' ? '#d97706' : '#059669');

        const formattedData = {
            month: data.month.toString(),
            year: data.year.toString(),
            percentage,
            monthlyBudget: `₹${data.monthlyBudget.toLocaleString('en-IN')}`,
            spent: `₹${data.spent.toLocaleString('en-IN')}`,
            status: data.status.toUpperCase(),
            statusColor,
            dashboardUrl: `${dashboardUrl}/budget`
        };

        const html = this.loadTemplate('budget-alert', formattedData);
        return this.sendEmail({
            to,
            subject: `Budget Alert: ${percentage}% of monthly budget used`,
            html
        });
    }

    /**
     * Send Bill Reminder
     */
    static async sendBillReminder(
        to: string,
        data: {
            cardName: string;
            billDate: Date;
            dueDate: Date;
            amount?: number;
        }
    ): Promise<boolean> {
        const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        const formattedData = {
            cardName: data.cardName,
            billDate: dayjs(data.billDate).format('D MMM YYYY'),
            dueDate: dayjs(data.dueDate).format('D MMM YYYY'),
            amountRow: data.amount ? `<tr><td style="padding: 8px 0; color: #6b7280;">Amount</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">₹${data.amount.toLocaleString('en-IN')}</td></tr>` : '',
            dashboardUrl: `${dashboardUrl}/bills`
        };

        const html = this.loadTemplate('bill-reminder', formattedData);
        return this.sendEmail({
            to,
            subject: `Bill Reminder: ${data.cardName}`,
            html
        });
    }
}
