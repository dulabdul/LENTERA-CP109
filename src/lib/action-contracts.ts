import { z } from 'zod';
import { aqiEstimateSchema, audienceSchema, dataMetaSchema, isoUtcSchema, locationSchema } from './contracts';
import { ACTION_SOURCE } from './action-catalog';
import { HOUR_MS, MINUTE_MS, POLICY } from './policy';
import { currentHour } from './time';
const common = {
  audience: audienceSchema, location: locationSchema, forTime: isoUtcSchema,
  ruleVersion: z.literal(POLICY.RULE_VERSION), basisDataVersion: z.string().min(1).nullable(),
  reason: z.string().min(1), messages: z.array(z.string().min(1)).min(1).max(6),
  sourceUrls: z.array(z.literal(ACTION_SOURCE)).length(1), createdAt: isoUtcSchema, validUntil: isoUtcSchema,
};
export const actionResultSchema = z.discriminatedUnion('mode', [
  z.object({ ...common, mode: z.literal('limited'), ruleId: z.literal('LK-DATA-LIMITED-v1'), basis: z.null() }).strict(),
  z.object({ ...common, mode: z.literal('targeted'), ruleId: z.string().min(1), basis: aqiEstimateSchema.options[1] }).strict(),
]).superRefine((result, ctx) => {
  const created = Date.parse(result.createdAt), expiry = Date.parse(result.validUntil), hour = currentHour(new Date(created));
  if (expiry <= created || Date.parse(result.forTime) !== hour || expiry > hour + HOUR_MS
    || (result.mode === 'limited' && expiry > created + 5 * MINUTE_MS)
    || (result.mode === 'targeted' && (!result.basisDataVersion || result.ruleId !== `LK-AIR-${result.basis.category}-${result.audience}-v1`
      || Date.parse(result.basis.periodTo) !== hour || Date.parse(result.basis.periodFrom) !== hour - 23 * HOUR_MS))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid recommendation basis, rule or validity period' });
  }
});
export const recommendationResponseSchema = z.object({ meta: dataMetaSchema, result: actionResultSchema }).strict().superRefine((response, ctx) => {
  const { meta, result } = response;
  if (meta.dataVersion !== result.basisDataVersion || Date.parse(meta.evaluatedAt) !== Date.parse(result.createdAt)
    || (result.mode === 'targeted' && (meta.state !== 'ok' || !meta.validUntil || Date.parse(result.validUntil) > Date.parse(meta.validUntil)))) {
    ctx.addIssue({ code: 'custom', message: 'Recommendation does not match source metadata' });
  }
});
export type ActionResult = z.infer<typeof actionResultSchema>;
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;
export type TargetedActionResult = Extract<ActionResult, { mode: 'targeted' }>;
