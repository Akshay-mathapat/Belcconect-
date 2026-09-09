const { spawn, execSync } = require("child_process");
const os = require("os");
const path = require("path");

console.log("[CityConnect Launcher] Starting Backend Signaling Server (backend/server.js) & Frontend Next.js App...");

const backendProcess = spawn("node", ["backend/server.js"], {
  cwd: __dirname,
  stdio: "inherit"
});

const frontendProcess = os.platform() === "win32"
  ? spawn("cmd.exe", ["/d", "/s", "/c", "npm run dev"], {
      cwd: path.join(__dirname, "frontend"),
      stdio: "inherit"
    })
  : spawn("npm", ["run", "dev"], {
      cwd: path.join(__dirname, "frontend"),
      stdio: "inherit"
    });

const cleanup = () => {
  console.log("[CityConnect Launcher] Shutting down servers...");
  try {
    if (os.platform() === "win32") {
      execSync(`taskkill /pid ${backendProcess.pid} /T /F`, { stdio: 'ignore' });
      execSync(`taskkill /pid ${frontendProcess.pid} /T /F`, { stdio: 'ignore' });
    } else {
      backendProcess.kill();
      frontendProcess.kill();
    }
  } catch (e) {}
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
