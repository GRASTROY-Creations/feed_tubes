import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const overridesUrl = pathToFileURL(resolve(projectRoot, ".librewolf-overrides.cfg")).href;

const defaultLibreWolf =
  process.platform === "win32"
    ? "C:\\Program Files\\LibreWolf\\librewolf.exe"
    : "/usr/sbin/librewolf";

const librewolfBinary = process.env.LIBREWOLF_BIN || defaultLibreWolf;
const forwardedArgs = process.argv.slice(2);

const hasFirefoxArg = forwardedArgs.some(
  (arg) =>
    arg === "-f" ||
    arg === "--firefox" ||
    arg === "--firefox-binary" ||
    arg.startsWith("--firefox=") ||
    arg.startsWith("--firefox-binary=")
);

const args = [
  "x",
  "web-ext",
  "run",
  ...(hasFirefoxArg ? [] : [`--firefox=${librewolfBinary}`]),
  `--pref=autoadmin.global_config_url=${overridesUrl}`,
  ...forwardedArgs,
];

const child = spawn(process.execPath, args, {
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to start web-ext: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
