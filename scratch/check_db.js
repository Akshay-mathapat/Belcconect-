const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
for (const line of env.split("\n")) {
  if (line.startsWith("DATABASE_URL=")) {
    const raw = line.replace("DATABASE_URL=", "").trim().replace(/^['"]|['"]$/g, "");
    try {
      const u = new URL(raw);
      console.log("DB Host:", u.host);
      console.log("DB Path:", u.pathname);
    } catch (e) {
      console.log("Parse error:", e.message);
    }
  }
}
