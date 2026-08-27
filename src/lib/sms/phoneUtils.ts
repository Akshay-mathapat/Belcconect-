/**
  * Utility functions for Indian phone number normalization, validation, and security logging.
  */

/**
 * Normalizes and validates an Indian mobile phone number into E.164 format (+91XXXXXXXXXX).
 * Returns null if the number is invalid or not an Indian mobile number.
 */
export function normalizeIndianPhone(input: string | null | undefined): string | null {
  if (!input) return null;

  // Remove non-digit characters except leading plus if any
  let cleaned = input.trim();
  
  // If starts with +91, strip + for uniform processing
  if (cleaned.startsWith("+91")) {
    cleaned = cleaned.substring(3).replace(/\D/g, "");
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.substring(2).replace(/\D/g, "");
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.substring(1).replace(/\D/g, "");
  } else {
    cleaned = cleaned.replace(/\D/g, "");
  }

  // Validate 10-digit Indian mobile number starting with 6, 7, 8, or 9
  const indianMobileRegex = /^[6-9]\d{9}$/;
  if (!indianMobileRegex.test(cleaned)) {
    return null;
  }

  return `+91${cleaned}`;
}

/**
 * Masks a phone number for secure structured logging.
 * Example: "+919876543210" -> "+91******3210"
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "[NO_PHONE]";
  const normalized = normalizeIndianPhone(phone);
  if (!normalized || normalized.length < 13) {
    return "[INVALID_PHONE]";
  }
  // +91 (3 chars) + 6 masked digits + 4 trailing digits
  return `${normalized.substring(0, 3)}******${normalized.substring(9)}`;
}
