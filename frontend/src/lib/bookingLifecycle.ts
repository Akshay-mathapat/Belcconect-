/**
 * BelConnect - Booking Lifecycle State Machine & Access Control
 * Shared module defining canonical statuses, allowed transitions,
 * role authorization matrices, and time threshold validations.
 */

export type BookingStatus =
  | "Requested"
  | "Accepted"
  | "OnTheWay"
  | "Arrived"
  | "Started"
  | "Completed"
  | "Cancelled"
  | "Rejected"
  | "Expired"
  | "ProviderNoShow"
  | "CustomerNoShow";

export type UserRole = "customer" | "user" | "provider" | "admin" | "system";

export interface TransitionContext {
  createdAt?: string | Date | null;
  acceptedAt?: string | Date | null;
  arrivedAt?: string | Date | null;
  now?: Date;
  providerNoShowMinutes?: number;
  customerNoShowMinutes?: number;
  expiryMinutes?: number;
}

export interface TransitionValidationResult {
  allowed: boolean;
  normalizedStatus?: BookingStatus;
  reason?: string;
  httpStatus?: number;
}

// Configurable default thresholds
export const DEFAULT_BOOKING_EXPIRY_MINUTES = 10;
export const DEFAULT_PROVIDER_NO_SHOW_MINUTES = 30;
export const DEFAULT_CUSTOMER_NO_SHOW_MINUTES = 10;

/**
 * Normalizes input status (case-insensitive, snake_case or PascalCase)
 * to canonical BookingStatus.
 */
export function normalizeBookingStatus(status: unknown): BookingStatus | null {
  if (!status || typeof status !== "string") return null;
  const clean = status.trim().toLowerCase().replace(/[\s\-_]/g, "");

  switch (clean) {
    case "requested":
    case "pending":
    case "upcoming":
      return "Requested";
    case "accepted":
      return "Accepted";
    case "ontheway":
      return "OnTheWay";
    case "arrived":
      return "Arrived";
    case "started":
    case "inprogress":
      return "Started";
    case "completed":
    case "reviewsubmitted":
      return "Completed";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "rejected":
    case "declined":
      return "Rejected";
    case "expired":
      return "Expired";
    case "providernoshow":
      return "ProviderNoShow";
    case "customernoshow":
      return "CustomerNoShow";
    case "noshow":
      // Generic no_show defaults based on caller context, but return null if ambiguous
      return null;
    default:
      return null;
  }
}

/**
 * Central state machine transitions table.
 * Maps current status to array of valid next statuses.
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Requested: ["Accepted", "Cancelled", "Rejected", "Expired"],
  Accepted: ["OnTheWay", "Cancelled", "ProviderNoShow"],
  OnTheWay: ["Arrived", "Cancelled", "ProviderNoShow"],
  Arrived: ["Started", "CustomerNoShow", "Cancelled"],
  Started: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  Rejected: [],
  Expired: [],
  ProviderNoShow: [],
  CustomerNoShow: []
};

/**
 * Validates whether a given status transition is permitted for a user role,
 * including timing constraints (e.g. no-show windows, arrival prerequisites).
 */
export function validateStatusTransition(
  currentStatusRaw: unknown,
  targetStatusRaw: unknown,
  roleRaw: UserRole | string,
  context: TransitionContext = {}
): TransitionValidationResult {
  const currentStatus = normalizeBookingStatus(currentStatusRaw);
  const targetStatus = normalizeBookingStatus(targetStatusRaw);

  if (!currentStatus) {
    return {
      allowed: false,
      reason: `Invalid current booking status: '${String(currentStatusRaw)}'`,
      httpStatus: 400
    };
  }

  if (!targetStatus) {
    return {
      allowed: false,
      reason: `Invalid target booking status: '${String(targetStatusRaw)}'`,
      httpStatus: 400
    };
  }

  // Same status is a no-op
  if (currentStatus === targetStatus) {
    return { allowed: true, normalizedStatus: targetStatus };
  }

  // Normalize role
  const role: UserRole =
    roleRaw === "admin"
      ? "admin"
      : roleRaw === "provider"
      ? "provider"
      : roleRaw === "system"
      ? "system"
      : "customer";

  // Check state machine transitions table
  const allowedNextList = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedNextList.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Invalid status transition: cannot move from '${currentStatus}' to '${targetStatus}'`,
      httpStatus: 400
    };
  }

  // Admin and System bypass role-specific constraints (but still obey the state graph)
  if (role === "admin" || role === "system") {
    return { allowed: true, normalizedStatus: targetStatus };
  }

  const now = context.now ? new Date(context.now).getTime() : Date.now();

  // Role-specific constraints
  if (role === "customer") {
    // Customers can ONLY trigger Cancelled or ProviderNoShow
    if (targetStatus === "Cancelled") {
      // Customer cancellation: allowed ONLY before provider has "Arrived"
      if (currentStatus === "Arrived" || currentStatus === "Started") {
        return {
          allowed: false,
          reason: "Customer cancellation is not permitted once the service provider has arrived on-site.",
          httpStatus: 403
        };
      }
      return { allowed: true, normalizedStatus: targetStatus };
    }

    if (targetStatus === "ProviderNoShow") {
      // Customer may report provider no-show if provider accepted but hasn't arrived
      if (currentStatus !== "Accepted" && currentStatus !== "OnTheWay") {
        return {
          allowed: false,
          reason: "Provider no-show can only be reported for accepted or travelling bookings.",
          httpStatus: 400
        };
      }

      const thresholdMin = context.providerNoShowMinutes ?? DEFAULT_PROVIDER_NO_SHOW_MINUTES;
      const acceptedTime = context.acceptedAt
        ? new Date(context.acceptedAt).getTime()
        : context.createdAt
        ? new Date(context.createdAt).getTime()
        : null;

      if (!acceptedTime || isNaN(acceptedTime)) {
        return {
          allowed: false,
          reason: "Cannot verify acceptance timestamp for provider no-show reporting.",
          httpStatus: 400
        };
      }

      const elapsedMinutes = (now - acceptedTime) / (1000 * 60);
      if (elapsedMinutes < thresholdMin) {
        const remainingMin = Math.ceil(thresholdMin - elapsedMinutes);
        return {
          allowed: false,
          reason: `Provider no-show can only be reported ${thresholdMin} minutes after acceptance. Please wait ${remainingMin} more minute(s).`,
          httpStatus: 400
        };
      }

      return { allowed: true, normalizedStatus: targetStatus };
    }

    return {
      allowed: false,
      reason: `Forbidden: Customers cannot transition booking to '${targetStatus}'.`,
      httpStatus: 403
    };
  }

  if (role === "provider") {
    // Providers can transition to Accepted, Rejected, OnTheWay, Arrived, Started, Completed, Cancelled, CustomerNoShow
    switch (targetStatus) {
      case "Accepted":
      case "Rejected":
        if (currentStatus !== "Requested") {
          return {
            allowed: false,
            reason: `Booking can only be accepted or rejected when pending ('${currentStatus}').`,
            httpStatus: 400
          };
        }
        return { allowed: true, normalizedStatus: targetStatus };

      case "OnTheWay":
        if (currentStatus !== "Accepted") {
          return {
            allowed: false,
            reason: "Provider must accept booking before starting travel.",
            httpStatus: 400
          };
        }
        return { allowed: true, normalizedStatus: targetStatus };

      case "Arrived":
        if (currentStatus !== "OnTheWay") {
          return {
            allowed: false,
            reason: "Provider can only mark arrived after starting travel ('OnTheWay').",
            httpStatus: 400
          };
        }
        return { allowed: true, normalizedStatus: targetStatus };

      case "Started":
        if (currentStatus !== "Arrived") {
          return {
            allowed: false,
            reason: "Provider must arrive on-site before starting the service.",
            httpStatus: 400
          };
        }
        return { allowed: true, normalizedStatus: targetStatus };

      case "Completed":
        if (currentStatus !== "Started") {
          return {
            allowed: false,
            reason: "Service must be in progress ('Started') before it can be completed.",
            httpStatus: 400
          };
        }
        return { allowed: true, normalizedStatus: targetStatus };

      case "CustomerNoShow":
        if (currentStatus !== "Arrived") {
          return {
            allowed: false,
            reason: "Customer no-show can only be reported after provider has arrived on-site.",
            httpStatus: 400
          };
        }

        const customerThresholdMin = context.customerNoShowMinutes ?? DEFAULT_CUSTOMER_NO_SHOW_MINUTES;
        const arrivedTime = context.arrivedAt ? new Date(context.arrivedAt).getTime() : null;

        if (!arrivedTime || isNaN(arrivedTime)) {
          return {
            allowed: false,
            reason: "Cannot verify provider arrival timestamp for customer no-show reporting.",
            httpStatus: 400
          };
        }

        const elapsedArrivedMin = (now - arrivedTime) / (1000 * 60);
        if (elapsedArrivedMin < customerThresholdMin) {
          const remainingMin = Math.ceil(customerThresholdMin - elapsedArrivedMin);
          return {
            allowed: false,
            reason: `Customer no-show can only be reported after waiting at least ${customerThresholdMin} minutes on-site. Please wait ${remainingMin} more minute(s).`,
            httpStatus: 400
          };
        }

        return { allowed: true, normalizedStatus: targetStatus };

      case "Cancelled":
        return { allowed: true, normalizedStatus: targetStatus };

      default:
        return {
          allowed: false,
          reason: `Forbidden: Providers cannot transition booking to '${targetStatus}'.`,
          httpStatus: 403
        };
    }
  }

  return {
    allowed: false,
    reason: `Forbidden: Unknown user role '${String(roleRaw)}'.`,
    httpStatus: 403
  };
}

/**
 * Checks if a pending booking is eligible for auto-expiry (created > 10 min ago).
 */
export function isBookingExpired(
  status: BookingStatus,
  createdAt: string | Date | null | undefined,
  now = Date.now(),
  expiryMinutes = DEFAULT_BOOKING_EXPIRY_MINUTES
): boolean {
  if (status !== "Requested" || !createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return false;
  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  return currentTime - createdTime >= expiryMinutes * 60 * 1000;
}

/**
 * Convenience helper: checks if customer can cancel this booking.
 * Allowed strictly before provider arrives (i.e. Requested, Accepted, OnTheWay).
 */
export function canCustomerCancel(status: unknown): boolean {
  const normalized = normalizeBookingStatus(status);
  return normalized === "Requested" || normalized === "Accepted" || normalized === "OnTheWay";
}

/**
 * Convenience helper: checks if customer is eligible to report provider no-show.
 * Allowed when status is Accepted or OnTheWay and >= 30 mins have elapsed.
 */
export function canReportProviderNoShow(
  status: unknown,
  acceptedAt: string | Date | null | undefined,
  now: Date | number = Date.now(),
  thresholdMin = DEFAULT_PROVIDER_NO_SHOW_MINUTES
): boolean {
  const normalized = normalizeBookingStatus(status);
  if (normalized !== "Accepted" && normalized !== "OnTheWay") return false;
  if (!acceptedAt) return false;
  const acceptedTime = new Date(acceptedAt).getTime();
  if (isNaN(acceptedTime)) return false;
  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  return currentTime - acceptedTime >= thresholdMin * 60 * 1000;
}

/**
 * Convenience helper: checks if provider is eligible to report customer no-show.
 * Allowed when status is Arrived and >= 10 mins have elapsed.
 */
export function canReportCustomerNoShow(
  status: unknown,
  arrivedAt: string | Date | null | undefined,
  now: Date | number = Date.now(),
  thresholdMin = DEFAULT_CUSTOMER_NO_SHOW_MINUTES
): boolean {
  const normalized = normalizeBookingStatus(status);
  if (normalized !== "Arrived") return false;
  if (!arrivedAt) return false;
  const arrivedTime = new Date(arrivedAt).getTime();
  if (isNaN(arrivedTime)) return false;
  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  return currentTime - arrivedTime >= thresholdMin * 60 * 1000;
}
