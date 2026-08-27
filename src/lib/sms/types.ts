export interface SmsSendOptions {
  to: string; // Phone number
  message: string;
  templateId?: string; // DLT Template ID for Indian SMS Gateways
  senderId?: string; // DLT approved Sender ID (e.g. BELCON)
}

export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  statusCode?: number;
}

export interface BookingSmsDetails {
  bookingId: string;
  serviceName: string;
  date: string;
  time: string;
  providerName?: string;
}

export interface SmsProvider {
  name: string;
  sendSms(options: SmsSendOptions): Promise<SmsSendResult>;
}
