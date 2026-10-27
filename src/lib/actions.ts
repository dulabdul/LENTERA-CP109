import "server-only";
import { z } from "zod";
import { aqiEstimateSchema, audienceSchema, dataMetaSchema, locationSchema, type AqiCategory, type AqiEstimate, type Audience, type DataMeta, type Location } from "./contracts";
import { HOUR_MS, MINUTE_MS, POLICY } from "./policy";
import { currentHour } from "./time";

import { ACTION_SOURCE } from "./action-catalog";
import type { ActionResult } from "./action-contracts";
import { aqiLabels } from "./air-view";
export { ACTION_SOURCE } from "./action-catalog";
const MESSAGES: Record<AqiCategory, { general: string; cautious: string }> = {
  good: { general: "Pantau perubahan kondisi sebelum merencanakan aktivitas.", cautious: "Pantau kondisi serta respons tubuh." },
  moderate: { general: "Pantau prakiraan dan perubahan kondisi.", cautious: "Pertimbangkan kegiatan luar ruang yang lebih singkat dan ringan bila sensitif." },
  sensitive: { general: "Pantau kondisi dan kurangi paparan bila terganggu.", cautious: "Kurangi durasi/intensitas kegiatan luar ruang dan tambah jeda." },
  unhealthy: { general: "Kurangi kegiatan luar ruang yang lama atau berat.", cautious: "Hindari kegiatan lama/berat di luar; pertimbangkan memindahkan atau menjadwalkan ulang." },
  very_unhealthy: { general: "Hindari kegiatan luar ruang yang lama/berat.", cautious: "Hindari aktivitas fisik di luar; pilih tempat dengan udara lebih bersih." },
  hazardous: { general: "Hindari aktivitas fisik di luar dan cari udara yang lebih bersih.", cautious: "Tetap di ruang dengan udara lebih bersih dan kurangi aktivitas; ikuti arahan otoritas." },
};

export function evaluateActions(input: { now: Date; meta: DataMeta; aqi: AqiEstimate; location: Location; audience: Audience }): ActionResult {
  const meta = dataMetaSchema.parse(input.meta);
  const audience = audienceSchema.parse(input.audience);
  const location = locationSchema.parse(input.location);
  const nowMs = input.now.getTime();
  if (!Number.isFinite(nowMs) || Date.parse(meta.evaluatedAt) > nowMs) throw new Error("Invalid action evaluation time");
  const hour = currentHour(input.now);
  const parsedAqi = aqiEstimateSchema.safeParse(input.aqi);
  const aqi: AqiEstimate = parsedAqi.success ? parsedAqi.data : { status: "unavailable", reason: "invalid-index" };
  const canTarget = meta.state === "ok" && meta.dataVersion !== null && meta.validUntil !== null
    && Date.parse(meta.validUntil) > nowMs && aqi.status === "available"
    && Date.parse(aqi.periodTo) === hour && Date.parse(aqi.periodFrom) === hour - 23 * HOUR_MS;
  const base = { audience, location, forTime: new Date(hour).toISOString(), ruleVersion: POLICY.RULE_VERSION, basisDataVersion: meta.dataVersion, sourceUrls: [ACTION_SOURCE] as Array<typeof ACTION_SOURCE>, createdAt: input.now.toISOString() };
  if (!canTarget || aqi.status !== "available") {
    const reason = meta.state === "unavailable" ? "Data udara untuk jam kini belum tersedia."
      : meta.state === "stale" || (meta.validUntil !== null && Date.parse(meta.validUntil) <= nowMs) ? "Data udara sudah lama atau batas kesegarannya telah berakhir."
      : meta.state === "partial" ? "Cakupan data udara belum lengkap."
      : aqi.status === "unavailable" ? "Indeks memerlukan 24 sampel model yang lengkap dan valid."
      : "Periode indeks belum sesuai dengan jam kini.";
    return { ...base, mode: "limited" as const, ruleId: "LK-DATA-LIMITED-v1", basis: null, reason, messages: ["Periksa waktu, sumber, dan keterbatasan data. Gunakan pedoman umum sambil menunggu informasi yang memadai."], validUntil: new Date(Math.min(nowMs + 5 * MINUTE_MS, hour + HOUR_MS)).toISOString() };
  }
  const category = aqi.category;
  return {
    ...base, mode: "targeted" as const, basis: aqi, ruleId: `LK-AIR-${category}-${audience}-v1`,
    reason: `Berdasarkan estimasi US AQI PM2.5 dari rerata model 24 jam untuk lokasi pilihan; kategori ${aqiLabels[category]}.`,
    messages: [audience === "general" ? MESSAGES[category].general : MESSAGES[category].cautious, "Rerata 24 jam tidak membuktikan tidak ada asap pada jam kini."],
    validUntil: new Date(Math.min(Date.parse(meta.validUntil!), hour + HOUR_MS)).toISOString(),
  };
}

export const audienceRequestSchema = z.object({ audience: audienceSchema.default("general") }).strict();
