import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { refreshTokens, userProfiles, users } from "$src/db/schema";
import { sanitizeUpdates } from "$src/utils";
import {
  UpdateProfileSchema,
  PROFILE_UPDATABLE_FIELDS,
  getProfileDocs,
  updateProfileDocs,
  getAccountDocs,
  ChangePasswordSchema,
  changePasswordDocs,
} from "./schema";

import preferences from "./preferences";
import notificationSettings from "./notification-settings";
import socialAuths from "./social-auths";
import interests from "./interests";
import education from "./education";
import wallets from "./wallets";
import friendRequests from "./friend-requests";
import notifications from "./notifications";

const me = new Hono<AppContext>();

// GET /me
me.get("/", guard("user"), getAccountDocs, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;

  const user = await db.query.users.findFirst({
    where: { id: userId },
    columns: { id: true, username: true, email: true, role: true, isActivated: true, createdAt: true },
  });

  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({ data: user });
});

// GET /me/profile
me.get("/profile", guard("user"), getProfileDocs, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;

  const profile = await db.query.userProfiles.findFirst({
    where: { userId },
  });

  if (!profile) return c.json({ error: "Profile not found" }, 404);

  return c.json({ data: profile });
});

// PATCH /me/profile
me.patch("/profile", guard("user"), updateProfileDocs, validator("json", UpdateProfileSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const body = c.req.valid("json");

  const sanitized = sanitizeUpdates(body, PROFILE_UPDATABLE_FIELDS);
  if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

  const [updated] = await db.update(userProfiles).set(sanitized).where(eq(userProfiles.userId, userId)).returning();

  if (!updated) return c.json({ error: "Profile not found" }, 404);

  return c.json({ data: updated });
});

// PATCH /me/password
me.patch("/password", guard("user"), changePasswordDocs, validator("json", ChangePasswordSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const { currentPassword, newPassword, confirmPassword } = c.req.valid("json");

  if (newPassword !== confirmPassword) {
    return c.json({ error: "Passwords do not match" }, 400);
  }

  const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));

  if (!user) return c.json({ error: "User not found" }, 404);
  if (!user.passwordHash) return c.json({ error: "Password not set for this account" }, 400);

  const isMatch = await Bun.password.verify(currentPassword, user.passwordHash);
  if (!isMatch) return c.json({ error: "Invalid current password" }, 401);

  const hashedPassword = await Bun.password.hash(newPassword, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 2,
  });

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  });

  return c.json({ message: "Password updated successfully" });
});


me.route("/preferences", preferences);
me.route("/notification-settings", notificationSettings);
me.route("/social-auths", socialAuths);
me.route("/interests", interests);
me.route("/education", education);
me.route("/wallets", wallets);
me.route("/friend-requests", friendRequests);
me.route("/notifications", notifications);

export default me;
