import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Fresh source archives exclude .next. Generate route declarations first so
// typechecking works before a development server or production build exists.
for (const [file, ...args] of [
  ["node_modules/next/dist/bin/next", "typegen"],
  ["node_modules/typescript/bin/tsc", "--noEmit"],
]) {
  const result = spawnSync(process.execPath, [resolve(file), ...args], {
    stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
