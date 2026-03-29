import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { generateAccessToken, generateOpaqueToken, hashToken, isLegacyPassword } from "$src/lib/jwt";
import type { AppContext } from "$src/types";
import { validator } from "hono-openapi";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  users,
  userProfiles,
  userPreferences,
  userNotificationSettings,
  activationTokens,
  userSocialAuths,
  refreshTokens,
} from "$src/db/schema";
import { Role } from "$src/db/schema";
import { env } from "$env";
import { verifyWordpressPassword } from "$src/lib/jwt";

import {
  LoginSchema,
  RegisterSchema,
  SocialLoginSchema,
  RefreshTokenSchema,
  loginDocs,
  registerDocs,
  socialLoginDocs,
  refreshDocs,
  logoutDocs,
  ActivateAccountSchema,
  activateDocs,
  ForgotPasswordSchema,
  forgotPasswordDocs,
  ResetPasswordSchema,
  resetPasswordDocs,
} from "./schema";

const AUTH_PROVIDERS = {
  GOOGLE: {
    JWKS_URL: "https://www.googleapis.com/oauth2/v3/certs",
    ISSUERS: ["https://accounts.google.com", "accounts.google.com"],
  },
} as const;

const auth = new Hono<AppContext>();

const googleJWKS = createRemoteJWKSet(new URL(AUTH_PROVIDERS.GOOGLE.JWKS_URL));

auth.post("/login", loginDocs, validator("json", LoginSchema), async (c) => {
  const db = c.get("db");

  const { email, password } = c.req.valid("json");

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !user.passwordHash) {
    c.get("debugData").userNotFound = true;
    return c.json({ error: "Invalid credentials" }, 401);
  }
  const legacy = isLegacyPassword(user.passwordHash);

  const isMatch = legacy
    ? await verifyWordpressPassword(password, user.passwordHash)
    : await Bun.password.verify(password, user.passwordHash);

  if (isMatch && legacy) {
    const modernPassword = await Bun.password.hash(password, {
      algorithm: "argon2id",
      memoryCost: 65536, // 64MB memory usage per hash
      timeCost: 2,
    });
    await db
      .update(users)
      .set({
        passwordHash: modernPassword,
      })
      .where(eq(users.id, user.id));
  }

  if (!isMatch) {
    c.get("debugData").invalidPassword = true;
    return c.json({ error: "Invalid credentials" }, 401);
  }

  if (!user.isActivated) {
    c.get("debugData").accountNotActivated = true;
    return c.json({ error: "Account not activated" }, 403);
  }

  const { rawToken, hashedToken } = generateOpaqueToken();
  const familyId = crypto.randomUUID();

  const accessToken = await generateAccessToken({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    sessionId: familyId,
  });

  const familyExpiresAt = new Date();
  familyExpiresAt.setDate(familyExpiresAt.getDate() + 30);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // todo add useragent and more data for the family id
  await db.insert(refreshTokens).values({
    userId: user.id,
    token: hashedToken,
    familyId,
    expiresAt,
    familyExpiresAt: familyExpiresAt,
  });

  return c.json({ accessToken, refreshToken: rawToken });
});

auth.post("/register", registerDocs, validator("json", RegisterSchema), async (c) => {
  const db = c.get("db");
  const { email, password, username } = c.req.valid("json");

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (user) {
    return c.json({ error: "User already exists" }, 409);
  }

  const hashedPassword = await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 65536, // 64MB memory usage per hash
    timeCost: 2,
  });

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { hashedToken, rawToken } = generateOpaqueToken();

  try {
    await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          username,
          email,
          passwordHash: hashedPassword,
        })
        .returning({ id: users.id });

      await tx.insert(userProfiles).values({ userId: newUser.id });
      await tx.insert(userPreferences).values({ userId: newUser.id });
      await tx.insert(userNotificationSettings).values({ userId: newUser.id });

      await tx.insert(activationTokens).values({
        userId: newUser.id,
        token: hashedToken,
        expiresAt,
      });
    });
    c.get("debugData").activationToken = rawToken;
    // TODO: Send email with `rawToken`
    // await sendEmail(email, `https://mindplex.ai/activate?token=${rawToken}`);
    return c.json({ message: "User registered. Please check your email to activate." }, 201);
  } catch (error: any) {
    if (error.code === "23505") {
      return c.json({ error: "Username or email already exists" }, 409);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

auth.post("/activate", activateDocs, validator("json", ActivateAccountSchema), async (c) => {
  const db = c.get("db");
  const { token: rawIncomingToken } = c.req.valid("json");

  const hashedIncomingToken = hashToken(rawIncomingToken);

  const [record] = await db
    .select()
    .from(activationTokens)
    .innerJoin(users, eq(activationTokens.userId, users.id))
    .where(eq(activationTokens.token, hashedIncomingToken))
    .limit(1);

  if (!record) {
    return c.json({ error: "Invalid activation token" }, 400);
  }

  if (new Date(record.activation_tokens.expiresAt) < new Date()) {
    await db.delete(activationTokens).where(eq(activationTokens.id, record.activation_tokens.id));
    return c.json({ error: "Token expired. Please request a new one." }, 400);
  }

  const user = record.users;

  if (user.isActivated) {
    return c.json({ message: "Account is already activated" });
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActivated: true }).where(eq(users.id, user.id));

    await tx.delete(activationTokens).where(eq(activationTokens.id, record.activation_tokens.id));
  });

  return c.json({ message: "Account successfully activated" });
});

auth.post("/forgot-password", forgotPasswordDocs, validator("json", ForgotPasswordSchema), async (c) => {
  const db = c.get("db");
  const { email } = c.req.valid("json");

  const [user] = await db
    .select({ id: users.id, email: users.email, isActivated: users.isActivated })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.isActivated) {
    return c.json({ message: "If the email exists, a reset link has been sent." });
  }

  const { rawToken, hashedToken } = generateOpaqueToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  await db.transaction(async (tx) => {
    await tx.delete(activationTokens).where(eq(activationTokens.userId, user.id));

    await tx.insert(activationTokens).values({
      userId: user.id,
      token: hashedToken,
      expiresAt,
    });
  });

  c.get("debugData").resetPasswordToken = rawToken;
  // TODO: Send email with `rawToken`
  // await sendEmail(user.email, `https://mindplex.ai/reset-password?token=${rawToken}`);

  return c.json({ message: "If the email exists, a reset link has been sent." });
});

auth.post("/reset-password", resetPasswordDocs, validator("json", ResetPasswordSchema), async (c) => {
  const db = c.get("db");
  const { token: rawIncomingToken, newPassword } = c.req.valid("json");

  const hashedIncomingToken = hashToken(rawIncomingToken);

  const [record] = await db
    .select()
    .from(activationTokens)
    .innerJoin(users, eq(activationTokens.userId, users.id))
    .where(eq(activationTokens.token, hashedIncomingToken))
    .limit(1);

  if (!record) {
    return c.json({ error: "Invalid or expired token" }, 400);
  }

  if (new Date(record.activation_tokens.expiresAt) < new Date()) {
    await db.delete(activationTokens).where(eq(activationTokens.id, record.activation_tokens.id));
    return c.json({ error: "Invalid or expired token" }, 400);
  }

  const hashedPassword = await Bun.password.hash(newPassword, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 2,
  });

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, record.users.id));

    await tx.delete(activationTokens).where(eq(activationTokens.id, record.activation_tokens.id));
  });

  return c.json({ message: "Password reset successfully" });
});

auth.post("/social", socialLoginDocs, validator("json", SocialLoginSchema), async (c) => {
  const db = c.get("db");

  const { provider, idToken, referralCode } = c.req.valid("json");

  let verifiedEmail: string;
  let providerId: string;
  let firstName = "";
  let lastName = "";
  let avatarUrl = "";

  try {
    if (provider === "google") {
      const { payload } = await jwtVerify(idToken, googleJWKS, {
        issuer: [...AUTH_PROVIDERS.GOOGLE.ISSUERS],
        audience: env.GOOGLE_CLIENT_ID,
      });

      if (!payload.email_verified) {
        return c.json({ error: "Google email must be verified" }, 403);
      }

      providerId = payload.sub!;
      verifiedEmail = payload.email as string;
      firstName = (payload.given_name as string) || "";
      lastName = (payload.family_name as string) || "";
      avatarUrl = (payload.picture as string) || "";
    } else {
      return c.json({ error: "Provider not yet implemented" }, 501);
    }
  } catch (error) {
    console.warn(`[SECURITY] Invalid ${provider} token attempted`);
    return c.json({ error: "Invalid or expired social token" }, 401);
  }

  let finalUserId: number;
  let userRole: Role = "user";

  await db.transaction(async (tx) => {
    const [existingAuth] = await tx
      .select()
      .from(userSocialAuths)
      .where(and(eq(userSocialAuths.provider, provider), eq(userSocialAuths.providerId, providerId)))
      .limit(1);

    if (existingAuth) {
      finalUserId = existingAuth.userId;
      const [u] = await tx.select({ role: users.role }).from(users).where(eq(users.id, finalUserId));
      userRole = u.role;
      return;
    }

    const [existingUser] = await tx.select().from(users).where(eq(users.email, verifiedEmail)).limit(1);

    if (existingUser) {
      finalUserId = existingUser.id;
      userRole = existingUser.role;

      await tx.insert(userSocialAuths).values({
        userId: finalUserId,
        provider,
        providerId,
      });
      return;
    }

    const baseUsername = verifiedEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
    const uniqueUsername = `${baseUsername}_${crypto.randomUUID().split("-")[0]}`;

    const [newUser] = await tx
      .insert(users)
      .values({
        username: uniqueUsername,
        email: verifiedEmail,
        isActivated: true,
      })
      .returning({ id: users.id });

    finalUserId = newUser.id;

    await tx.insert(userProfiles).values({
      userId: finalUserId,
      firstName,
      lastName,
      avatarUrl,
    });
    await tx.insert(userPreferences).values({ userId: finalUserId });
    await tx.insert(userNotificationSettings).values({ userId: finalUserId });
    await tx.insert(userSocialAuths).values({
      userId: finalUserId,
      provider,
      providerId,
    });
  });

  const familyId = crypto.randomUUID();
  const accessToken = await generateAccessToken({
    sub: String(finalUserId!),
    email: verifiedEmail,
    role: userRole,
    sessionId: familyId,
  });

  const { rawToken: refreshToken, hashedToken } = generateOpaqueToken();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const familyExpiresAt = new Date();
  familyExpiresAt.setDate(familyExpiresAt.getDate() + 30);

  const userAgent = c.req.header("user-agent") || "Unknown Device";
  const ip = c.req.header("x-forwarded-for") || "Unknown IP";

  await db.insert(refreshTokens).values({
    userId: finalUserId!,
    token: hashedToken,
    familyId,
    metadata: { userAgent, ip },
    expiresAt,
    familyExpiresAt,
  });

  return c.json({ accessToken, refreshToken });
});

auth.post("/refresh", refreshDocs, validator("json", RefreshTokenSchema), async (c) => {
  const db = c.get("db");

  const { refreshToken: rawIncomingToken } = c.req.valid("json");

  const hashedIncomingToken = hashToken(rawIncomingToken);

  const [savedToken] = await db
    .select()
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(eq(refreshTokens.token, hashedIncomingToken))
    .limit(1);

  if (!savedToken) return c.json({ error: "Invalid token" }, 401);

  const tokenData = savedToken.refresh_tokens;
  const user = savedToken.users;

  if (new Date(tokenData.expiresAt) < new Date()) {
    return c.json({ error: "Session inactive for too long. Please log in." }, 401);
  }

  if (new Date(tokenData.familyExpiresAt) < new Date()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.familyId, tokenData.familyId));
    return c.json({ error: "Session expired. Please log in again." }, 401);
  }

  if (tokenData.isRevoked) {
    await db.delete(refreshTokens).where(eq(refreshTokens.familyId, tokenData.familyId));

    console.warn(`[SECURITY] Token reuse detected for user ${user.id}. Session terminated.`);
    return c.json({ error: "Security alert: Token reuse detected. Please log in again." }, 403);
  }

  const newAccessToken = await generateAccessToken({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    sessionId: tokenData.familyId,
  });

  const { rawToken: newRawToken, hashedToken: newHashedToken } = generateOpaqueToken();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const newIdleExpiresAt = new Date();
  newIdleExpiresAt.setDate(newIdleExpiresAt.getDate() + 7);

  await db.transaction(async (tx) => {
    await tx.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.id, tokenData.id));

    await tx.insert(refreshTokens).values({
      userId: user.id,
      token: newHashedToken,
      familyId: tokenData.familyId,
      expiresAt: newIdleExpiresAt,
      familyExpiresAt: tokenData.familyExpiresAt,
    });
  });

  return c.json({ accessToken: newAccessToken, refreshToken: newRawToken });
});

auth.post("/logout", logoutDocs, validator("json", RefreshTokenSchema), async (c) => {
  const db = c.get("db");
  const { refreshToken: rawToken } = c.req.valid("json");

  const hashedToken = hashToken(rawToken);

  const [tokenRecord] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.token, hashedToken))
    .limit(1);

  if (tokenRecord) {
    await db.delete(refreshTokens).where(eq(refreshTokens.familyId, tokenRecord.familyId));
  }

  return c.json({ message: "Logged out successfully" });
});
export default auth;
