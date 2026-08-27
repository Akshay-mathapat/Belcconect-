import { SmsProvider, SmsSendOptions, SmsSendResult } from "./types";
import { maskPhoneNumber } from "./phoneUtils";

/**
 * Development Mode Provider: Logs SMS payloads without sending network requests
 */
export class DevSmsProvider implements SmsProvider {
  name = "Development Mode Provider";

  async sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
    const maskedPhone = maskPhoneNumber(options.to);
    console.log(`[SMS DEV MODE] Simulated SMS Dispatch:`);
    console.log(`  To: ${maskedPhone}`);
    console.log(`  Message: "${options.message}"`);
    console.log(`  Template ID: ${options.templateId || "N/A"}`);
    console.log(`  Sender ID: ${options.senderId || "N/A"}`);

    return {
      success: true,
      providerMessageId: `dev-sim-${Date.now()}`
    };
  }
}

/**
 * Production Indian SMS Gateway Adapter (Fast2SMS / Standard REST DLT Gateway)
 */
export class Fast2SmsProvider implements SmsProvider {
  name = "Fast2SMS / Indian DLT Gateway";

  private apiKey: string;
  private defaultSenderId: string;
  private defaultTemplateId: string;

  constructor() {
    this.apiKey = process.env.SMS_API_KEY || "";
    this.defaultSenderId = process.env.SMS_SENDER_ID || "BELCON";
    this.defaultTemplateId = process.env.SMS_DLT_TEMPLATE_ID || "";
  }

  async sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
    if (!this.apiKey) {
      console.warn("[SMS Provider] Missing SMS_API_KEY environment variable.");
      return {
        success: false,
        error: "SMS_API_KEY not configured"
      };
    }

    // Clean 10-digit number for Indian local gateways
    const cleanNumbers = options.to.replace(/\+91/, "").replace(/\D/g, "");

    try {
      // Fast2SMS DLT Quick Transactional / Message API
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          "authorization": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          route: "dlt",
          sender_id: options.senderId || this.defaultSenderId,
          message: options.templateId || this.defaultTemplateId,
          variables_values: options.message,
          numbers: cleanNumbers
        })
      });

      const data = await response.json();

      if (response.ok && data?.return === true) {
        return {
          success: true,
          providerMessageId: data.request_id || `fast2sms-${Date.now()}`
        };
      } else {
        const errorMsg = data?.message || data?.error || `HTTP Status ${response.status}`;
        console.error(`[SMS Provider Error] Fast2SMS returned failure for ${maskPhoneNumber(options.to)}:`, errorMsg);
        return {
          success: false,
          error: errorMsg,
          statusCode: response.status
        };
      }
    } catch (err: any) {
      console.error(`[SMS Provider Exception] Exception connecting to SMS Gateway for ${maskPhoneNumber(options.to)}:`, err?.message || err);
      return {
        success: false,
        error: err?.message || "Network error connecting to SMS Gateway"
      };
    }
  }
}

/**
 * Factory helper to get active SMS Provider based on environment configuration
 */
export function getSmsProvider(): SmsProvider {
  const enabled = process.env.SMS_ENABLED === "true";
  const providerName = (process.env.SMS_PROVIDER || "").toLowerCase();

  if (!enabled || providerName === "dev") {
    return new DevSmsProvider();
  }

  return new Fast2SmsProvider();
}
