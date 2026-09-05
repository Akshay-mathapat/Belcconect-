const { spawn, execSync } = require("child_process");
const os = require("os");

console.log("[CityConnect Launcher] Starting Signaling Server (Port 4001) & Next.js App...");

const signalingProcess = spawn("node", ["signaling-server/server.js"], {
  stdio: "inherit",
  shell: os.platform() === "win32"
});

const nextProcess = spawn("npx", ["next", "dev", "--webpack"], {
  stdio: "inherit",
  shell: os.platform() === "win32"
});

const cleanup = () => {
  console.log("[CityConnect Launcher] Shutting down servers...");
  try {
    if (os.platform() === "win32") {
      execSync(`taskkill /pid ${signalingProcess.pid} /T /F`, { stdio: 'ignore' });
      execSync(`taskkill /pid ${nextProcess.pid} /T /F`, { stdio: 'ignore' });
    } else {
      signalingProcess.kill();
      nextProcess.kill();
    }
  } catch (e) {}
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
