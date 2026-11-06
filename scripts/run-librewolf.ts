import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hasFirefoxArg } from "./browser-binary.js";
import { startDevLoop } from "./dev.js";
import { PROJECT_ROOT } from "./extension-build.js";

const DEFAULT_LIBREWOLF =
  process.platform === "win32"
    ? String.raw`C:\Program Files\LibreWolf\librewolf.exe`
    : "/usr/sbin/librewolf";

const overridesUrl = pathToFileURL(resolve(PROJECT_ROOT, ".librewolf-overrides.cfg")).href;
const librewolfBinary = process.env.LIBREWOLF_BIN ?? DEFAULT_LIBREWOLF;
const forwardedArgs = process.argv.slice(2);

await startDevLoop([
  ...(hasFirefoxArg(forwardedArgs) ? [] : [`--firefox=${librewolfBinary}`]),
  `--pref=autoadmin.global_config_url=${overridesUrl}`,
  ...forwardedArgs,
]);
