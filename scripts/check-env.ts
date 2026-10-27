import nextEnv from "@next/env";
import { readEnvironment } from "../src/lib/env";
import { z } from "zod";

nextEnv.loadEnvConfig(process.cwd());
try {
  const env = readEnvironment();
  console.log(JSON.stringify({ valid: true, readiness: env.readiness, note: "Configuration presence does not verify provider connectivity. No secret values printed." }, null, 2));
} catch (error) {
  if (error instanceof z.ZodError) console.error(JSON.stringify({ valid: false, fields: error.issues.map(issue => issue.path.join(".")) }));
  else console.error("Environment validation failed");
  process.exitCode = 1;
}
