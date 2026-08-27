const { spawn } = require("child_process");

console.log("[CityConnect Launcher] Starting Signaling Server (Port 4001) & Next.js App...");

const signalingProcess = spawn("node", ["signaling-server/server.js"], {
  stdio: "inherit",
  shell: true
});

const nextProcess = spawn("npx", ["next", "dev", "--webpack"], {
  stdio: "inherit",
  shell: true
});

const cleanup = () => {
  try { signalingProcess.kill(); } catch (e) {}
  try { nextProcess.kill(); } catch (e) {}
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
