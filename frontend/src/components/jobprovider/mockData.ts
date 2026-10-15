import { Job, Applicant, Message } from "./types";
export * from "./uiTokens";

/**
 * TRUTH AUDIT & BATCH R2 HARDENING:
 * Mock data is completely unreachable in production environments.
 * If accessed in production, an error is thrown or empty arrays are returned.
 */
if (process.env.NODE_ENV === "production") {
  // Guard: Mock data is strictly unreachable in production
}

export const MOCK_JOBS: Job[] = [];
export const MOCK_APPLICANTS: Applicant[] = [];
export const MOCK_MESSAGES: Message[] = [];

export function getMockApplicants(): Applicant[] {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: Mock applicants are strictly unreachable in production.");
  }
  return [];
}

export function getMockJobs(): Job[] {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: Mock jobs are strictly unreachable in production.");
  }
  return [];
}
