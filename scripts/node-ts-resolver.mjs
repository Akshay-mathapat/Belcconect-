import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// Resolve ts extensions and @/ alias for node test runner
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    specifier = "next/server.js";
  } else if (specifier === "next/headers") {
    specifier = "next/headers.js";
  }

  let target = specifier;

  if (specifier.startsWith("@/")) {
    const root = path.resolve(process.cwd(), "frontend/src");
    target = path.join(root, specifier.slice(2));
  } else if (specifier.startsWith(".") && context.parentURL) {
    try {
      const parentPath = fileURLToPath(context.parentURL);
      target = path.resolve(path.dirname(parentPath), specifier);
    } catch {}
  }

  // If target is relative, absolute or alias path without extension
  if (target.startsWith(".") || target.startsWith("/") || target.startsWith("C:") || target.startsWith("c:") || path.isAbsolute(target)) {
    for (const ext of [".ts", ".tsx", ".js", "/index.ts", "/index.js"]) {
      if (fs.existsSync(target + ext)) {
        return {
          shortCircuit: true,
          url: pathToFileURL(target + ext).href
        };
      }
    }
  }

  return nextResolve(specifier, context);
}

