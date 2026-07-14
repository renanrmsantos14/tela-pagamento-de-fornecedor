import { execFileSync, spawn } from "node:child_process";
import process from "node:process";

const port = Number(process.env.PORT || 5192);
const root = process.cwd();

function pidsOnPort() {
  try {
    if (process.platform === "win32") {
      const output = execFileSync("netstat.exe", ["-ano", "-p", "tcp"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return [...new Set(output.split(/\r?\n/).filter((line) => line.includes(`:${port}`) && /\sLISTENING\s+\d+\s*$/i.test(line)).map((line) => Number(line.match(/(\d+)\s*$/)?.[1])).filter(Boolean))];
    }

    const output = execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return [...new Set(output.split(/\s+/).filter(Boolean).map(Number))];
  } catch {
    return [];
  }
}

function stopProcess(pid) {
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    console.log(`[dev] porta ${port} ocupada pelo processo ${pid}; processo encerrado.`);
  } catch {
    console.warn(`[dev] nao foi possivel encerrar o processo ${pid}.`);
  }
}

for (const pid of pidsOnPort()) {
  if (pid !== process.pid) stopProcess(pid);
}

const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", String(port), "--strictPort"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

const forwardSignal = (signal) => vite.kill(signal);
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
vite.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
