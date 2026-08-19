import { z } from "zod";

/**
 * mily-fan-site の Realtime API 契約。
 * field 名・状態値は child repo の実装から写したもので、推測で足さない。
 *
 * /api/mily-live      … api/mily-live.js + src/lib/realtimeStore.ts LivePayload
 * /api/mily-radio-status … api/mily-radio-status.js + src/data/radio.ts RadioStatus
 * /api/mily-schedule  … api/mily-schedule.js normalizeSlot
 */

export const MilyLiveStateSchema = z.enum(["live", "offline", "unknown"]);
export const MilyNextLiveStateSchema = z.enum(["scheduled", "none", "unknown"]);

export const MilyLivePayloadSchema = z.object({
  ok: z.boolean(),
  roomUrl: z.string().nullable().optional(),
  live: z.object({
    state: MilyLiveStateSchema,
    liveId: z.union([z.number(), z.null()]).optional(),
    startedAt: z.string().nullable().optional(),
    observedAt: z.string().nullable().optional(),
  }),
  next: z
    .object({
      state: MilyNextLiveStateSchema,
      at: z.string().nullable().optional(),
    })
    .optional(),
});

export const MilyRadioSchedulePhaseSchema = z.enum([
  "upcoming",
  "window",
  "ended",
  "idle",
]);

export const MilyRadioStatusSchema = z.object({
  ok: z.boolean(),
  programName: z.string().min(1),
  todayScheduled: z.boolean(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  inScheduledWindow: z.boolean(),
  schedulePhase: MilyRadioSchedulePhaseSchema,
  nextStartAt: z.string().nullable(),
  onAirConfirmed: z.union([z.literal(true), z.literal(false), z.null()]),
  milyAppearanceConfirmed: z.null(),
  listenUrl: z.string(),
  sourceUrl: z.string(),
  lastVerifiedAt: z.string(),
  updatedAt: z.string(),
});

export const MilyScheduleSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const MilySchedulePayloadSchema = z.object({
  ok: z.boolean(),
  slots: z.array(MilyScheduleSlotSchema),
  source: z
    .object({
      roomUrl: z.string().nullable().optional(),
    })
    .passthrough()
    .optional(),
});

export type MilyLivePayload = z.infer<typeof MilyLivePayloadSchema>;
export type MilyRadioStatus = z.infer<typeof MilyRadioStatusSchema>;
export type MilyScheduleSlot = z.infer<typeof MilyScheduleSlotSchema>;
export type MilySchedulePayload = z.infer<typeof MilySchedulePayloadSchema>;
