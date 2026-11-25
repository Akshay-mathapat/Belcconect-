/**
 * Suppress Node.js runtime deprecation warnings (such as DEP0169 url.parse())
 * emitted by third-party dependencies (e.g. web-push, nodemailer).
 *
 * In Vercel serverless functions, any stderr stream output is automatically
 * categorized as an "Error" in the Runtime Logs dashboard, even for passing (200 OK) requests.
 */

if (typeof process !== "undefined" && typeof process.emitWarning === "function") {
  const originalEmitWarning = process.emitWarning;

  process.emitWarning = function (warning: any, ...args: any[]) {
    // 1. Suppress DEP0169 url.parse() deprecation warning
    if (
      warning === "DEP0169" ||
      (typeof warning === "string" && (warning.includes("DEP0169") || warning.includes("url.parse()"))) ||
      (warning && typeof warning === "object" && (warning.code === "DEP0169" || (warning.message && warning.message.includes("url.parse()"))))
    ) {
      return;
    }

    // 2. Suppress DEP0040 punycode deprecation warning
    if (
      warning === "DEP0040" ||
      (typeof warning === "string" && warning.includes("DEP0040")) ||
      (warning && typeof warning === "object" && warning.code === "DEP0040")
    ) {
      return;
    }

    return originalEmitWarning.apply(process, [warning, ...args] as any);
  };
}

export {};
