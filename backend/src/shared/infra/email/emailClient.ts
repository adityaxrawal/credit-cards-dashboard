import nodemailer from 'nodemailer';
import { env } from '@shared/config/env';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(env.SMTP_PORT || '587'),
  secure: false, // Use TLS
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email notification
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('[EmailClient] Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('[EmailClient] Error sending email:', error);
    return false;
  }
}

/**
 * Send budget alert email
 */
export async function sendBudgetAlert(
  email: string,
  data: {
    month: number;
    year: number;
    monthlyBudget: number;
    spent: number;
    status: string;
  }
): Promise<boolean> {
  const percentage = ((data.spent / data.monthlyBudget) * 100).toFixed(1);

  const html = `
    <h2>Budget Alert</h2>
    <p>Your spending for ${data.month}/${data.year} has reached <strong>${percentage}%</strong> of your monthly budget.</p>
    <ul>
      <li><strong>Budget:</strong> ₹${data.monthlyBudget.toFixed(2)}</li>
      <li><strong>Spent:</strong> ₹${data.spent.toFixed(2)}</li>
      <li><strong>Status:</strong> ${data.status.toUpperCase()}</li>
    </ul>
    <p>Please review your spending to stay within your budget.</p>
  `;

  return sendEmail({
    to: email,
    subject: `Budget Alert: ${percentage}% of monthly budget used`,
    html,
    text: `Your spending has reached ${percentage}% of your monthly budget (₹${data.spent.toFixed(2)} / ₹${data.monthlyBudget.toFixed(2)})`,
  });
}

/**
 * Send bill reminder email
 */
export async function sendBillReminder(
  email: string,
  data: {
    cardName: string;
    billDate: Date;
    dueDate: Date;
    amount?: number;
  }
): Promise<boolean> {
  const html = `
    <h2>Bill Reminder</h2>
    <p>Your credit card bill is coming up:</p>
    <ul>
      <li><strong>Card:</strong> ${data.cardName}</li>
      <li><strong>Bill Date:</strong> ${data.billDate.toLocaleDateString()}</li>
      <li><strong>Due Date:</strong> ${data.dueDate.toLocaleDateString()}</li>
      ${data.amount ? `<li><strong>Amount:</strong> ₹${data.amount.toFixed(2)}</li>` : ''}
    </ul>
  `;

  return sendEmail({
    to: email,
    subject: `Bill Reminder: ${data.cardName}`,
    html,
    text: `Bill reminder for ${data.cardName}. Due date: ${data.dueDate.toLocaleDateString()}`,
  });
}
