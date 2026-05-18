import { spawn } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

const nextBin = require.resolve("next/dist/bin/next");
const args = ["dev", ...process.argv.slice(2)];

const child = spawn(process.execPath, [nextBin, ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
