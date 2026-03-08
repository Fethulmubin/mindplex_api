import { Hono } from "hono";
import { eq, and, count, or } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext, IncludeConfig } from "$src/types";
import { buildFieldSelection, buildRelationalWith } from "$src/utils";
import { guard } from "$src/middleware/auth";
import { ACCESS, users, follows, friendRequests } from "$src/db/schema";
import type { DbClient } from "$src/db/client";
import {
  FOLLOW_FORBIDDEN_COLUMNS,
  UsernameParamSchema,
  UserDetailsQuerySchema,
  FollowListQuerySchema,
  getPublicProfileDocs,
  listFollowersDocs,
  listFollowingDocs,
  followUserDocs,
  unfollowUserDocs,
  blockUserDocs,
  unblockUserDocs,
  sendFriendRequestDocs,
  USER_FORBIDDEN_COLUMNS,
} from "./schema";

const app = new Hono<AppContext>();

// ─── Include Configs ────────────────────────────────────────

const USER_INCLUDES: Record<string, IncludeConfig<"users">> = {
  profile: {
    requiredRole: ACCESS.Public,
    drizzleWith: {
      profile: {
        columns: { firstName: true, lastName: true, avatarUrl: true, bio: true },
      },
    },
  },
} as const;

const FOLLOWER_INCLUDES: Record<string, IncludeConfig<"follows">> = {
  follower: {
    requiredRole: ACCESS.Public,
    drizzleWith: {
      follower: {
        columns: { id: true, username: true },
        with: { profile: { columns: { avatarUrl: true, firstName: true, lastName: true } } },
      },
    },
  },
} as const;

const FOLLOWING_INCLUDES: Record<string, IncludeConfig<"follows">> = {
  following: {
    requiredRole: ACCESS.Public,
    drizzleWith: {
      following: {
        columns: { id: true, username: true },
        with: { profile: { columns: { avatarUrl: true, firstName: true, lastName: true } } },
      },
    },
  },
} as const;

// ─── Helpers ────────────────────────────────────────────────

async function findUserByUsername(db: DbClient, username: string) {
  return db.query.users.findFirst({
    where: { username },
    columns: { id: true, username: true },
  });
}

// GET /:username
app.get(
  "/",
  guard("optional"),
  getPublicProfileDocs,
  validator("param", UsernameParamSchema),
  validator("query", UserDetailsQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { username } = c.req.valid("param");
    const { fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");

    const selection = buildFieldSelection(users, fields, USER_FORBIDDEN_COLUMNS, { id: true });
    const relationalWith = buildRelationalWith(include, USER_INCLUDES, userRole);

    const data = await db.query.users.findFirst({
      where: { username },
      columns: selection,
      with: relationalWith,
    });

    if (!data) return c.json({ error: "User not found" }, 404);

    return c.json({ data });
  },
);

// GET /:username/followers
app.get(
  "/followers",
  guard("optional"),
  listFollowersDocs,
  validator("param", UsernameParamSchema),
  validator("query", FollowListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { username } = c.req.valid("param");
    const { limit, page, fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");

    const target = await findUserByUsername(db, username);
    if (!target) return c.json({ error: "User not found" }, 404);

    const selection = buildFieldSelection(follows, fields, FOLLOW_FORBIDDEN_COLUMNS, { id: true });
    const relationalWith = buildRelationalWith(include, FOLLOWER_INCLUDES, userRole);

    const [data, [{ total }]] = await Promise.all([
      db.query.follows.findMany({
        where: { followingId: target.id, status: "follow" },
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
      }),
      db
        .select({ total: count() })
        .from(follows)
        .where(and(eq(follows.followingId, target.id), eq(follows.status, "follow"))),
    ]);

    return c.json({ data, total });
  },
);

// GET /:username/following
app.get(
  "/following",
  guard("optional"),
  listFollowingDocs,
  validator("param", UsernameParamSchema),
  validator("query", FollowListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { username } = c.req.valid("param");
    const { limit, page, fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");

    const target = await findUserByUsername(db, username);
    if (!target) return c.json({ error: "User not found" }, 404);

    const selection = buildFieldSelection(follows, fields, FOLLOW_FORBIDDEN_COLUMNS, { id: true });
    const relationalWith = buildRelationalWith(include, FOLLOWING_INCLUDES, userRole);

    const [data, [{ total }]] = await Promise.all([
      db.query.follows.findMany({
        where: { followerId: target.id, status: "follow" },
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
      }),
      db
        .select({ total: count() })
        .from(follows)
        .where(and(eq(follows.followerId, target.id), eq(follows.status, "follow"))),
    ]);

    return c.json({ data, total });
  },
);

// POST /:username/follow
app.post("/follow", guard("user"), followUserDocs, validator("param", UsernameParamSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const { username } = c.req.valid("param");

  const target = await findUserByUsername(db, username);
  if (!target) return c.json({ error: "User not found" }, 404);
  if (target.id === userId) return c.json({ error: "Cannot follow yourself" }, 400);

  const [record] = await db
    .insert(follows)
    .values({ followerId: userId, followingId: target.id, status: "follow" })
    .onConflictDoUpdate({
      target: [follows.followerId, follows.followingId],
      set: { status: "follow" },
    })
    .returning();

  return c.json({ data: record }, 201);
});

// DELETE /:username/follow
app.delete("/follow", guard("user"), unfollowUserDocs, validator("param", UsernameParamSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const { username } = c.req.valid("param");

  const target = await findUserByUsername(db, username);
  if (!target) return c.json({ error: "User not found" }, 404);

  const deleted = await db
    .delete(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followingId, target.id), eq(follows.status, "follow")))
    .returning();

  if (deleted.length === 0) return c.json({ error: "Not following this user" }, 404);

  return c.body(null, 204);
});

// POST /:username/block
app.post("/block", guard("user"), blockUserDocs, validator("param", UsernameParamSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const { username } = c.req.valid("param");

  const target = await findUserByUsername(db, username);
  if (!target) return c.json({ error: "User not found" }, 404);
  if (target.id === userId) return c.json({ error: "Cannot block yourself" }, 400);

  const [record] = await db
    .insert(follows)
    .values({ followerId: userId, followingId: target.id, status: "block" })
    .onConflictDoUpdate({
      target: [follows.followerId, follows.followingId],
      set: { status: "block" },
    })
    .returning();

  return c.json({ data: record }, 201);
});

// DELETE /:username/block
app.delete("/block", guard("user"), unblockUserDocs, validator("param", UsernameParamSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const { username } = c.req.valid("param");

  const target = await findUserByUsername(db, username);
  if (!target) return c.json({ error: "User not found" }, 404);

  const deleted = await db
    .delete(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followingId, target.id), eq(follows.status, "block")))
    .returning();

  if (deleted.length === 0) return c.json({ error: "User is not blocked" }, 404);

  return c.body(null, 204);
});

// POST /:username/friend-requests
app.post(
  "/friend-requests",
  guard("user"),
  sendFriendRequestDocs,
  validator("param", UsernameParamSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { username } = c.req.valid("param");

    const target = await findUserByUsername(db, username);
    if (!target) return c.json({ error: "User not found" }, 404);
    if (target.id === userId) return c.json({ error: "Cannot send a friend request to yourself" }, 400);

    // Check for existing request in either direction
    const existing = await db.query.friendRequests.findFirst({
      where: {
        OR: [
          { requesterId: userId, requestedId: target.id },
          { requesterId: target.id, requestedId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === "pending") {
        return c.json({ error: "A pending friend request already exists between you and this user" }, 400);
      }
      if (existing.status === "accepted") {
        return c.json({ error: "You are already friends with this user" }, 400);
      }
    }

    const [record] = await db
      .insert(friendRequests)
      .values({ requesterId: userId, requestedId: target.id, status: "pending" })
      .returning();

    return c.json({ data: record }, 201);
  },
);

export default app;
