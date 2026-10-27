import { z } from "zod";

const optional = z.preprocess(value => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(value => typeof value === "string" && value.trim() === "" ? undefined : value, z.url().refine(value => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}, "Expected HTTPS URL without embedded credentials").optional());

const serverSchema = z.object({
  FIRMS_MAP_KEY: optional, R2_ENDPOINT: optionalUrl, R2_BUCKET: optional,
  R2_ACCESS_KEY_ID: optional, R2_SECRET_ACCESS_KEY: optional,
  OPEN_METEO_BASE_URL: optionalUrl, OPEN_METEO_API_KEY: optional,
  RATE_LIMIT_PROVIDER: z.preprocess(value => value === "" ? undefined : value, z.enum(["hosting", "persistent"]).optional()),
  RATE_LIMIT_SECRET: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()),
  AIR_UPSTREAM_REQUESTS_PER_DAY: z.preprocess(value => value === "" || value === undefined ? undefined : Number(value), z.number().int().min(1).max(1_000_000).optional()),
}).superRefine((env, ctx) => {
  const names = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
  const present = names.filter(name => env[name]);
  if (present.length > 0 && present.length < names.length) ctx.addIssue({ code: "custom", path: ["R2_ENDPOINT"], message: "Configure all R2 values together" });
  let url: URL;
  try { url = new URL(env.OPEN_METEO_BASE_URL ?? 'https://air-quality-api.open-meteo.com'); } catch { return; }
  if (!['air-quality-api.open-meteo.com', 'customer-air-quality-api.open-meteo.com'].includes(url.hostname) || url.port || url.search || url.hash || url.pathname !== '/') {
    ctx.addIssue({ code: 'custom', path: ['OPEN_METEO_BASE_URL'], message: 'Use a supported official Open-Meteo air endpoint origin' });
  }
  if (url.hostname.startsWith('customer-') !== !!env.OPEN_METEO_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['OPEN_METEO_API_KEY'], message: 'Customer endpoint and API key must be configured together' });
  }
});

export function readEnvironment(source: Record<string, string | undefined> = process.env) {
  const server = serverSchema.parse(source);
  return {
    server: { ...server, OPEN_METEO_BASE_URL: server.OPEN_METEO_BASE_URL ?? "https://air-quality-api.open-meteo.com" },
    public: { cartoApiKey: source.NEXT_PUBLIC_CARTO_API_KEY?.trim() || null },
    readiness: {
      firms: server.FIRMS_MAP_KEY ? "configured-not-tested" : "not-configured",
      r2: server.R2_ENDPOINT ? "configured-not-tested" : "not-configured",
      carto: source.NEXT_PUBLIC_CARTO_API_KEY?.trim() ? "configured-not-tested" : "not-configured",
      rateLimiter: server.RATE_LIMIT_PROVIDER ? "configured-not-tested" : "not-configured",
      openMeteo: "endpoint-configured-not-tested",
    },
  };
}
