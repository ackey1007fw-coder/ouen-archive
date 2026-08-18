import { z } from "zod";

export const PersonIdSchema = z.enum([
  "mily",
  "yukako",
  "riri",
  "chizuru",
  "mako",
]);

export type PersonId = z.infer<typeof PersonIdSchema>;

export const PortalFeedItemTypeSchema = z.enum([
  "news",
  "story",
  "schedule",
  "event",
  "update",
]);

const IsoDateTimeWithOffsetSchema = z
  .string()
  .datetime({ offset: true })
  .regex(/(?:Z|[+-]\d{2}:\d{2})$/, "Timezone offset is required");

export const PortalFeedItemSchema = z
  .object({
    id: z.string().min(1).max(160),
    personId: PersonIdSchema,
    type: PortalFeedItemTypeSchema,
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(500).optional(),
    url: z.string().url(),
    sourceUrl: z.string().url().optional(),
    publishedAt: IsoDateTimeWithOffsetSchema,
    updatedAt: IsoDateTimeWithOffsetSchema.optional(),
    startsAt: IsoDateTimeWithOffsetSchema.optional(),
    endsAt: IsoDateTimeWithOffsetSchema.optional(),
    image: z.string().url().optional(),
  })
  .strict();

export const PortalFeedSchema = z
  .object({
    version: z.literal(1),
    personId: PersonIdSchema,
    siteName: z.string().min(1).max(100),
    siteUrl: z.string().url(),
    generatedAt: IsoDateTimeWithOffsetSchema,
    items: z.array(PortalFeedItemSchema).max(20),
  })
  .strict()
  .superRefine((feed, context) => {
    const siteOrigin = new URL(feed.siteUrl).origin;

    feed.items.forEach((item, index) => {
      if (item.personId !== feed.personId) {
        context.addIssue({
          code: "custom",
          message: "Item personId must match feed personId",
          path: ["items", index, "personId"],
        });
      }

      if (!item.id.startsWith(`${feed.personId}:`)) {
        context.addIssue({
          code: "custom",
          message: "Item id must start with the feed personId",
          path: ["items", index, "id"],
        });
      }

      if (item.image && new URL(item.image).origin !== siteOrigin) {
        context.addIssue({
          code: "custom",
          message: "Item image must be hosted by the source site",
          path: ["items", index, "image"],
        });
      }
    });
  });

export type PortalFeedItem = z.infer<typeof PortalFeedItemSchema>;
export type PortalFeed = z.infer<typeof PortalFeedSchema>;
