
import { test, expect } from "@playwright/test";
import { validateBookingDateTime } from "../src/lib/bookingDateValidation";

const NOW = Date.parse("2026-10-09T04:30:00.000Z");

test.describe("BelConnect Booking Date Validation", () => {
  test("accepts valid future booking", () => {
    const result = validateBookingDateTime(
      "2026-10-10",
      "9:00 AM - 10:00 AM",
      NOW
    );
    expect(result.valid).toBe(true);
  });

  test("rejects past booking date", () => {
    const result = validateBookingDateTime(
      "2026-10-08",
      "9:00 AM - 10:00 AM",
      NOW
    );
    expect(result.valid).toBe(false);
  });

  test("rejects invalid calendar date", () => {
    const result = validateBookingDateTime(
      "2026-02-30",
      "9:00 AM - 10:00 AM",
      NOW
    );
    expect(result.valid).toBe(false);
  });

  test("rejects invalid date format", () => {
    const result = validateBookingDateTime(
      "10-10-2026",
      "9:00 AM - 10:00 AM",
      NOW
    );
    expect(result.valid).toBe(false);
  });

  test("rejects missing date", () => {
    const result = validateBookingDateTime(
      "",
      "9:00 AM - 10:00 AM",
      NOW
    );
    expect(result.valid).toBe(false);
  });

  test("rejects missing time", () => {
    const result = validateBookingDateTime(
      "2026-10-10",
      "",
      NOW
    );
    expect(result.valid).toBe(false);
  });

  test("rejects invalid time format", () => {
    const result = validateBookingDateTime(
      "2026-10-10",
      "morning",
      NOW
    );
    expect(result.valid).toBe(false);
  });

  test("rejects reversed time range", () => {
    const result = validateBookingDateTime(
      "2026-10-10",
      "5:00 PM - 4:00 PM",
      NOW
    );
    expect(result.valid).toBe(false);
  });

  test("rejects expired time slot today", () => {
    const result = validateBookingDateTime(
      "2026-10-09",
      "9:00 AM - 10:00 AM",
      NOW
    );
    expect(result.valid).toBe(false);
  });

  test("accepts future time slot today", () => {
    const result = validateBookingDateTime(
      "2026-10-09",
      "2:00 PM - 3:00 PM",
      NOW
    );
    expect(result.valid).toBe(true);
  });
});
