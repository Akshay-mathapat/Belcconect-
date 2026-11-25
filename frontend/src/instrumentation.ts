/**
 * Next.js Server Instrumentation
 * Runs automatically on cold-start before any route or page is executed.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/suppressWarnings");
  }
}
