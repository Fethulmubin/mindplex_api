import { Hono } from "hono";
import { and, count, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { notifications } from "$src/db/schema";
import { PAGINATION_RULES } from "$src/lib/validators";
import {
  NotificationListQuerySchema,
  NotificationIdParamSchema,
  listMyNotificationsDocs,
  markAllNotificationsReadDocs,
  markNotificationReadDocs,
} from "./schema";

const app = new Hono<AppContext>();
const DEFAULT_LIMIT = Number(PAGINATION_RULES.DEFAULT_LIMIT);

function serializeNotification(record: typeof notifications.$inferSelect) {
  return {
    ...record,
    id: record.id.toString(),
  };
}

// GET /me/notifications?page={page}
app.get("/", guard("user"), listMyNotificationsDocs, validator("query", NotificationListQuerySchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const { page } = c.req.valid("query");

  const [data, [{ notSeen }]] = await Promise.all([
    db.query.notifications.findMany({
      where: { userId },
      limit: DEFAULT_LIMIT,
      offset: (page - 1) * DEFAULT_LIMIT,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    }),
    db
      .select({ notSeen: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.status, "unread"))),
  ]);

  return c.json({ data: data.map(serializeNotification), not_seen: Number(notSeen) });
});

// PATCH /me/notifications
app.patch("/", guard("user"), markAllNotificationsReadDocs, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;

  const updated = await db
    .update(notifications)
    .set({ status: "read", readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.status, "unread")))
    .returning({ id: notifications.id });

  return c.json({ message: "Notifications marked as read", updatedCount: updated.length });
});

// PATCH /me/notifications/:id
app.patch(
  "/:id",
  guard("user"),
  markNotificationReadDocs,
  validator("param", NotificationIdParamSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");

    const existing = await db.query.notifications.findFirst({
      where: { id, userId },
      columns: { id: true },
    });

    if (!existing) return c.json({ error: "Notification not found" }, 404);

    const [updated] = await db
      .update(notifications)
      .set({ status: "read", readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return c.json({ data: serializeNotification(updated) });
  },
);

export default app;
