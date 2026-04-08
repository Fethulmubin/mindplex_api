import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";
import { PaginationPageSchema } from "$src/lib/validators";

export const NotificationListQuerySchema = v.object({
  page: PaginationPageSchema,
});

export const NotificationIdParamSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^\d+$/), v.transform((value) => BigInt(value))),
});

const NotificationRecordSchema = v.object({
  id: v.union([v.string(), v.number()]),
  userId: v.number(),
  actorId: v.optional(v.nullable(v.number())),
  type: v.string(),
  targetId: v.optional(v.nullable(v.number())),
  targetType: v.optional(v.nullable(v.string())),
  message: v.optional(v.nullable(v.string())),
  status: v.string(),
  readAt: v.optional(v.nullable(v.string())),
  createdAt: v.string(),
});

const NotificationListResponseSchema = v.object({
  data: v.array(NotificationRecordSchema),
  not_seen: v.number(),
});

const MarkReadResponseSchema = v.object({
  message: v.string(),
  updatedCount: v.number(),
});

const NotificationSingleResponseSchema = v.object({
  data: NotificationRecordSchema,
});

export const listMyNotificationsDocs = describeRoute({
  tags: ["Users"],
  summary: "Get My Notifications",
  security: [{ bearerAuth: [] }],
  description: "Returns paginated notifications for the authenticated user with an unread count in not_seen.",
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": { schema: resolver(NotificationListResponseSchema) },
      },
    },
    401: { description: "Unauthorized" },
  },
});

export const markAllNotificationsReadDocs = describeRoute({
  tags: ["Users"],
  summary: "Mark All Notifications As Read",
  security: [{ bearerAuth: [] }],
  description: "Marks all unread notifications for the authenticated user as read.",
  responses: {
    200: {
      description: "Updated",
      content: {
        "application/json": { schema: resolver(MarkReadResponseSchema) },
      },
    },
    401: { description: "Unauthorized" },
  },
});

export const markNotificationReadDocs = describeRoute({
  tags: ["Users"],
  summary: "Mark Notification As Read",
  security: [{ bearerAuth: [] }],
  description: "Marks one notification as read for the authenticated user.",
  responses: {
    200: {
      description: "Updated",
      content: {
        "application/json": { schema: resolver(NotificationSingleResponseSchema) },
      },
    },
    401: { description: "Unauthorized" },
    404: { description: "Notification not found" },
  },
});
