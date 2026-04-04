import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

// ─── Profile ────────────────────────────────────────────────

export const UpdateProfileSchema = v.partial(
  v.object({
    firstName: v.pipe(v.string(), v.maxLength(100)),
    lastName: v.pipe(v.string(), v.maxLength(100)),
    avatarUrl: v.string(),
    bio: v.string(),
    dateOfBirth: v.string(),
    gender: v.pipe(v.string(), v.maxLength(50)),
    education: v.pipe(v.string(), v.maxLength(255)),
    socialMedia: v.record(v.string(), v.string()),
  }),
);

export const PROFILE_UPDATABLE_FIELDS = new Set([
  "firstName",
  "lastName",
  "avatarUrl",
  "bio",
  "dateOfBirth",
  "gender",
  "education",
  "socialMedia",
]);

const ProfileResponseSchema = v.object({
  userId: v.number(),
  firstName: v.nullable(v.string()),
  lastName: v.nullable(v.string()),
  avatarUrl: v.nullable(v.string()),
  bio: v.nullable(v.string()),
  dateOfBirth: v.nullable(v.string()),
  gender: v.nullable(v.string()),
  education: v.nullable(v.string()),
  socialMedia: v.optional(v.any()),
});

export const getProfileDocs = describeRoute({
  tags: ["Users"],

  summary: "Get My Profile",
  security: [{ bearerAuth: [] }],
  description: "Returns the authenticated user's profile.",
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(v.object({ data: ProfileResponseSchema })) } },
    },
    404: { description: "Profile not found" },
  },
});

export const updateProfileDocs = describeRoute({
  tags: ["Users"],
  summary: "Update My Profile",
  security: [{ bearerAuth: [] }],
  description: "Partially updates the authenticated user's profile.",
  responses: {
    200: {
      description: "Updated",
      content: { "application/json": { schema: resolver(v.object({ data: ProfileResponseSchema })) } },
    },
    400: { description: "No valid fields to update" },
    404: { description: "Profile not found" },
  },
});

// ─── Password ───────────────────────────────────────────────

export const ChangePasswordSchema = v.object({
  currentPassword: v.string("Current password is required"),
  newPassword: v.pipe(v.string("New password is required"), v.minLength(8, "Password must be at least 8 characters")),
  confirmPassword: v.string("Confirm password is required"),
});

const ChangePasswordResponseSchema = v.object({
  message: v.string(),
});

export const changePasswordDocs = describeRoute({
  tags: ["Users"],
  summary: "Change Password",
  security: [{ bearerAuth: [] }],
  description: "Changes the authenticated user's password and invalidates all active sessions.",
  responses: {
    200: {
      description: "Password updated",
      content: { "application/json": { schema: resolver(ChangePasswordResponseSchema) } },
    },
    400: { description: "Invalid password request" },
    401: { description: "Invalid current password" },
    404: { description: "User not found" },
  },
});

// ─── Account ────────────────────────────────────────────────

const AccountResponseSchema = v.object({
  id: v.number(),
  username: v.string(),
  email: v.string(),
  role: v.string(),
  isActivated: v.optional(v.nullable(v.boolean())),
  createdAt: v.string(),
});

export const getAccountDocs = describeRoute({
  tags: ["Users"],
  summary: "Get My Account",
  security: [{ bearerAuth: [] }],
  description: "Returns the authenticated user's basic account info.",
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(v.object({ data: AccountResponseSchema })) } },
    },
    404: { description: "User not found" },
  },
});
