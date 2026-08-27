import { z } from "zod";
import { NextResponse } from "next/server";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .max(255, "Email is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(100, "Password exceeds maximum length"),
});

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(255, "Email address is too long"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .max(100, "Password exceeds maximum length"),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(255, "Name is too long")
    .optional(),
  phone: z
    .string()
    .trim()
    .max(50, "Phone number is too long")
    .optional(),
  role: z.enum(["user", "provider", "job_provider"]),
  avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
});

export const createBookingSchema = z.object({
  serviceId: z.string().optional(),
  providerId: z.string().optional(),
  serviceName: z.string().min(1, "Service name is required"),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Booking date is required"),
  time: z.string().min(1, "Booking time is required"),
  serviceAddressId: z.string().optional(),
  destinationAddress: z.string().optional(),
  destinationLatitude: z.number().optional(),
  destinationLongitude: z.number().optional(),
});

export const createAddressSchema = z.object({
  type: z.string().min(1, "Address type is required").max(50),
  text: z.string().min(5, "Address text must be at least 5 characters"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

/**
 * Helper function to validate request JSON body against a Zod schema.
 */
export async function parseAndValidate<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; response?: undefined } | { data?: undefined; response: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      );
      return {
        response: NextResponse.json(
          {
            error: "Validation error",
            details: errorMessages,
          },
          { status: 400 }
        ),
      };
    }
    return { data: result.data };
  } catch (error) {
    return {
      response: NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      ),
    };
  }
}
