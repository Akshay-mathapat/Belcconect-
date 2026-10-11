
export type BookingDateValidationResult =
  | { valid: true; bookingStartUtc: number }
  | { valid: false; error: string };

const IST_OFFSET_MINUTES = 330;

export function validateBookingDateTime(
  date: unknown,
  time: unknown,
  now: number = Date.now()
): BookingDateValidationResult {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return { valid: false, error: "Invalid booking date format" };
  }

  const [year, month, day] = date.split("-").map(Number);

  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1000 ||
    !Number.isFinite(calendarDate.getTime()) ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() + 1 !== month ||
    calendarDate.getUTCDate() !== day
  ) {
    return { valid: false, error: "Invalid booking date" };
  }

  const slotMatch =
    typeof time === "string"
      ? time.match(
          /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*(?:\u2013|\u2014|-)\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i
        )
      : null;

  if (!slotMatch) {
    return { valid: false, error: "Invalid time slot format" };
  }

  const startHour12 = Number(slotMatch[1]);
  const startMinute = Number(slotMatch[2]);
  const endHour12 = Number(slotMatch[4]);
  const endMinute = Number(slotMatch[5]);

  if (
    startHour12 < 1 || startHour12 > 12 ||
    endHour12 < 1 || endHour12 > 12 ||
    startMinute > 59 || endMinute > 59
  ) {
    return { valid: false, error: "Invalid time slot values" };
  }

  const to24Hour = (hour: number, meridiem: string) =>
    (hour % 12) + (meridiem.toUpperCase() === "PM" ? 12 : 0);

  const startMinutes =
    to24Hour(startHour12, slotMatch[3]) * 60 + startMinute;

  const endMinutes =
    to24Hour(endHour12, slotMatch[6]) * 60 + endMinute;

  if (endMinutes <= startMinutes) {
    return {
      valid: false,
      error: "Time slot must end after it starts"
    };
  }

  const bookingStartUtc =
    calendarDate.getTime() +
    startMinutes * 60_000 -
    IST_OFFSET_MINUTES * 60_000;

  if (bookingStartUtc <= now) {
    return {
      valid: false,
      error: "Cannot book a past date or time slot"
    };
  }

  return { valid: true, bookingStartUtc };
}
