import nodemailer from "nodemailer";

export interface SendPasswordResetOtpEmailParams {
  to: string;
  otp: string;
  expiresInMinutes?: number;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  missingVars?: string[];
}

let cachedTransporter: nodemailer.Transporter | null = null;

export function getSmtpMissingVars(): string[] {
  const missing: string[] = [];
  if (!process.env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!process.env.SMTP_PORT) missing.push("SMTP_PORT");
  if (!process.env.SMTP_USER) missing.push("SMTP_USER");
  if (!process.env.SMTP_PASS) missing.push("SMTP_PASS");
  if (!process.env.SMTP_FROM_EMAIL) missing.push("SMTP_FROM_EMAIL");
  return missing;
}

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;

  const missingVars = getSmtpMissingVars();
  if (missingVars.length > 0) {
    const errorMsg = `EMAIL_SMTP_CONFIG_MISSING: ${missingVars.join(", ")}`;
    console.error(`[EMAIL_SERVICE_ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const host = process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

/**
 * Optional SMTP connection verification for dev diagnostics
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log("[EMAIL] SMTP connection verified");
    return true;
  } catch (error: any) {
    console.error("[EMAIL_ERROR] SMTP verification failed:", error?.message || error);
    return false;
  }
}

/**
 * Helper to compute HMAC SHA-256 hash for OTP storage and verification
 */
export function hashOtpWithHmac(userId: string, otp: string): string {
  const crypto = require("crypto");
  const secret = process.env.PASSWORD_RESET_OTP_SECRET || "default_belconnect_otp_hmac_secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${otp}`)
    .digest("hex");
}

export async function sendPasswordResetOtpEmail({
  to,
  otp,
  expiresInMinutes = 10,
}: SendPasswordResetOtpEmailParams): Promise<SendEmailResult> {
  const missingVars = getSmtpMissingVars();
  if (missingVars.length > 0) {
    console.warn(`[PASSWORD_RESET_WARN] Missing SMTP config: ${missingVars.join(", ")}`);
    return {
      success: false,
      error: `EMAIL_SMTP_CONFIG_MISSING: ${missingVars.join(", ")}`,
      missingVars,
    };
  }

  try {
    const transporter = getTransporter();

    const fromEmail = process.env.SMTP_FROM_EMAIL || "no-reply@belconnect.com";
    const fromName = process.env.SMTP_FROM_NAME || "BelConnect";
    const from = `${fromName} <${fromEmail}>`;

    console.log("[PASSWORD_RESET] smtp-send-start");

    const info = await transporter.sendMail({
      from,
      to,
      subject: "BelConnect Password Reset Code",
      text: `Your BelConnect password reset code is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes.\n\nIf you did not request a password reset, you can ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0; font-size: 22px; font-weight: bold;">${fromName}</h2>
          </div>
          <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">Reset Your Password</h3>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">You requested a password reset code for your account.</p>
          <div style="background-color: #f1f5f9; padding: 18px; text-align: center; border-radius: 10px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e293b; margin: 24px 0;">
            ${otp}
          </div>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log(`[PASSWORD_RESET] smtp-send-success messageId=${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error("[PASSWORD_RESET_EMAIL_FAILED] Error sending email:", error?.message || error);
    return {
      success: false,
      error: error?.message || "Failed to send password reset email",
    };
  }
}
