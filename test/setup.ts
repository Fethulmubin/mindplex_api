import { generateAccessToken } from "$src/lib/jwt";
import { db } from "$src/db/client";
import * as schema from "$src/db/schema";
import { eq, inArray, like } from "drizzle-orm";
import type { Role } from "$src/db/schema/types";
import app from "$src/index";
import {
  TEST_PREFIX,
  USER_ROLES,
  POSTS,
  COMMENTS,
  REACTIONS,
  PEOPLES_CHOICE_VOTES,
  FOLLOWS,
  INTERESTS,
  EDUCATION,
  WALLETS,
  FRIEND_REQUESTS,
} from "./seed";

const BASE = "http://localhost:3000";

// ─── Types ──────────────────────────────────────────────

export type TestUser = {
  id: number;
  token: string;
  email: string;
  username: string;
  role: Role;
};

type TestComment = {
  id: number;
  postId: number;
  authorId: number;
  parentId?: number;
};

export type SeededData = {
  users: Record<"admin" | "editor" | "moderator" | "user", TestUser>;
  posts: { id: number; slug: string; authorId: number }[];
  comments: {
    byUser: TestComment;
    byEditor: TestComment;
    pending: TestComment;
    replies: TestComment[];
  };
  interests: { id: number; userId: number; interest: string }[];
  education: { id: number; userId: number }[];
  wallets: { id: number; userId: number; publicAddress: string | null }[];
  friendRequests: { id: number; requesterId: number; requestedId: number; status: string }[];
  follows: { id: number; followerId: number; followingId: number; status: string }[];
};

// ─── User Creation ──────────────────────────────────────

const tokenCache = new Map<string, TestUser>();

export async function asRole(role: Role): Promise<TestUser> {
  if (tokenCache.has(role)) return tokenCache.get(role)!;

  const username = `${TEST_PREFIX}${role}`;
  const email = `${username}@test.local`;
  const password = "testpass";

  let [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  if (!user) {
    const hash = await Bun.password.hash(password, {
      algorithm: "argon2id",
      memoryCost: 4096,
      timeCost: 1,
    });
    [user] = await db
      .insert(schema.users)
      .values({ username, email, passwordHash: hash, role, isActivated: true })
      .returning({ id: schema.users.id });
  }

  await db.insert(schema.userProfiles).values({ userId: user.id }).onConflictDoNothing();
  await db.insert(schema.userPreferences).values({ userId: user.id }).onConflictDoNothing();
  await db.insert(schema.userNotificationSettings).values({ userId: user.id }).onConflictDoNothing();

  const token = await generateAccessToken({
    sub: String(user.id),
    email,
    role,
    sessionId: `test-${role}`,
  });

  const testUser: TestUser = { id: user.id, token, email, username, role };
  tokenCache.set(role, testUser);
  return testUser;
}

// ─── Seed ───────────────────────────────────────────────

export async function seed(): Promise<SeededData> {
  // 1. Users
  const [admin, editor, moderator, user] = await Promise.all(USER_ROLES.map((role) => asRole(role)));
  const users = { admin, editor, moderator, user };
  const usersByRole: Record<string, TestUser> = users;

  // 2. Posts
  const postValues = POSTS.map((p) => ({
    authorId: usersByRole[p.authorRole].id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    type: p.type,
    content: p.content,
    commentEnabled: p.commentEnabled,
    isEditorsPick: p.isEditorsPick,
    publishedAt: p.publishedAt,
  }));

  const posts = await db.insert(schema.posts).values(postValues).returning({
    id: schema.posts.id,
    slug: schema.posts.slug,
    authorId: schema.posts.authorId,
  });

  const postsBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

  // 3. Comments
  const commentsByKey: Record<string, TestComment> = {};
  const replyRecords: TestComment[] = [];

  for (const fixture of COMMENTS) {
    const post = postsBySlug[fixture.postSlug];
    const parentId = fixture.parentKey ? commentsByKey[fixture.parentKey]?.id : undefined;

    const [row] = await db
      .insert(schema.comments)
      .values({
        postId: post.id,
        authorId: usersByRole[fixture.authorRole].id,
        content: fixture.content,
        status: fixture.status,
        parentId,
      })
      .returning({ id: schema.comments.id, postId: schema.comments.postId, authorId: schema.comments.authorId });

    const record: TestComment = { ...row, parentId };
    commentsByKey[fixture.key] = record;

    if (fixture.parentKey) replyRecords.push(record as TestComment);
  }

  // 4. Reactions
  if (REACTIONS.length > 0) {
    const reactionValues = REACTIONS.map((r) => ({
      postId: postsBySlug[r.postSlug].id,
      userId: usersByRole[r.userRole].id,
      reaction: r.reaction,
    }));
    await db.insert(schema.postReactions).values(reactionValues);
  }

  // 5. People's Choice Votes
  if (PEOPLES_CHOICE_VOTES.length > 0) {
    const voteValues = PEOPLES_CHOICE_VOTES.map((v) => ({
      postId: postsBySlug[v.postSlug].id,
      userId: usersByRole[v.userRole].id,
    }));
    await db.insert(schema.peoplesChoiceVotes).values(voteValues);
  }

  // 6. User Interests
  const interests = [];
  for (const fixture of INTERESTS) {
    const [row] = await db
      .insert(schema.userInterests)
      .values({
        userId: usersByRole[fixture.userRole].id,
        interest: fixture.interest,
        isPrimary: fixture.isPrimary,
      })
      .returning();
    interests.push(row);
  }

  // 7. User Education
  const education = [];
  for (const fixture of EDUCATION) {
    const [row] = await db
      .insert(schema.userEducation)
      .values({
        userId: usersByRole[fixture.userRole].id,
        educationalBackground: fixture.educationalBackground,
      })
      .returning();
    education.push(row);
  }

  // 8. Wallets
  const wallets = [];
  for (const fixture of WALLETS) {
    const [row] = await db
      .insert(schema.userWallets)
      .values({
        userId: usersByRole[fixture.userRole].id,
        publicAddress: fixture.publicAddress,
      })
      .returning();
    wallets.push(row);
  }

  // 9. Friend Requests
  const friendRequests = [];
  for (const fixture of FRIEND_REQUESTS) {
    const [row] = await db
      .insert(schema.friendRequests)
      .values({
        requesterId: usersByRole[fixture.requesterRole].id,
        requestedId: usersByRole[fixture.requestedRole].id,
        status: fixture.status,
      })
      .returning();
    friendRequests.push(row);
  }

  // 10. Follows
  const followsData = [];
  for (const fixture of FOLLOWS) {
    const [row] = await db
      .insert(schema.follows)
      .values({
        followerId: usersByRole[fixture.followerRole].id,
        followingId: usersByRole[fixture.followingRole].id,
        status: fixture.status,
      })
      .onConflictDoNothing()
      .returning();
    if (row) followsData.push(row);
  }

  return {
    users,
    posts,
    comments: {
      byUser: commentsByKey["byUser"],
      byEditor: commentsByKey["byEditor"],
      pending: commentsByKey["pending"],
      replies: replyRecords,
    },
    interests,
    education,
    wallets,
    friendRequests,
    follows: followsData,
  };
}

// ─── Cleanup ────────────────────────────────────────────

export async function cleanup() {
  // Collect test user IDs for user-scoped cleanup
  const testUserIds = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(like(schema.users.username, `${TEST_PREFIX}%`));

  const userIds = testUserIds.map((u) => u.id);

  // Post-scoped cleanup
  const testPostIds = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(like(schema.posts.slug, `${TEST_PREFIX}%`));

  const ids = testPostIds.map((p) => p.id);

  if (ids.length > 0) {
    await db.delete(schema.postReactions).where(inArray(schema.postReactions.postId, ids));
    await db.delete(schema.peoplesChoiceVotes).where(inArray(schema.peoplesChoiceVotes.postId, ids));
    await db.delete(schema.postStats).where(inArray(schema.postStats.postId, ids));
    await db.delete(schema.comments).where(inArray(schema.comments.postId, ids));
  }

  await db.delete(schema.posts).where(like(schema.posts.slug, `${TEST_PREFIX}%`));

  // User-scoped cleanup
  if (userIds.length > 0) {
    await db.delete(schema.follows).where(inArray(schema.follows.followerId, userIds));
    await db.delete(schema.follows).where(inArray(schema.follows.followingId, userIds));
    await db.delete(schema.userInterests).where(inArray(schema.userInterests.userId, userIds));
    await db.delete(schema.userEducation).where(inArray(schema.userEducation.userId, userIds));
    await db.delete(schema.userWallets).where(inArray(schema.userWallets.userId, userIds));
    await db.delete(schema.friendRequests).where(inArray(schema.friendRequests.requesterId, userIds));
    await db.delete(schema.friendRequests).where(inArray(schema.friendRequests.requestedId, userIds));
    await db.delete(schema.userSocialAuths).where(inArray(schema.userSocialAuths.userId, userIds));
    await db.delete(schema.userNotificationSettings).where(inArray(schema.userNotificationSettings.userId, userIds));
    await db.delete(schema.userPreferences).where(inArray(schema.userPreferences.userId, userIds));
    await db.delete(schema.userProfiles).where(inArray(schema.userProfiles.userId, userIds));
  }

  await db.delete(schema.users).where(like(schema.users.username, `${TEST_PREFIX}%`));
  tokenCache.clear();
}

// ─── API Client ─────────────────────────────────────────

type RequestOptions = {
  body?: Record<string, any>;
  token?: string;
  query?: Record<string, string>;
};

export const api = {
  get: (path: string, opts?: RequestOptions) => send("GET", path, opts),
  post: (path: string, opts?: RequestOptions) => send("POST", path, opts),
  patch: (path: string, opts?: RequestOptions) => send("PATCH", path, opts),
  delete: (path: string, opts?: RequestOptions) => send("DELETE", path, opts),
};

async function send(method: string, path: string, opts?: RequestOptions): Promise<Response> {
  let url = `${BASE}${path}`;

  if (opts?.query) {
    const params = new URLSearchParams(opts.query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {};
  if (opts?.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts?.body) headers["Content-Type"] = "application/json";

  return app.fetch(
    new Request(url, {
      method,
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    }),
  );
}
