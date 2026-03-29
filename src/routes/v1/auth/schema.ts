import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

export const LoginSchema = v.object({
  email: v.pipe(v.string("Email is required"), v.email("Invalid email format")),
  password: v.string("Password is required"),
});

export const RegisterSchema = v.object({
  email: v.pipe(v.string(), v.email(), v.maxLength(255, "Email cannot exceed 255 characters")),
  username: v.pipe(
    v.string(),
    v.minLength(3, "Username must be at least 3 characters"),
    v.maxLength(30, "Username cannot exceed 30 characters"),
  ),
  password: v.pipe(
    v.string("Password is required"),
    v.minLength(8, "Password must be at least 8 characters"),
    v.maxLength(255, "Password is too long"),
  ),
});

export const SocialLoginSchema = v.object({
  provider: v.union([v.literal("google"), v.literal("github")]),
  idToken: v.string("ID token is required"),
  referralCode: v.optional(v.string()),
});

export const RefreshTokenSchema = v.object({
  refreshToken: v.pipe(v.string("Refresh token is required"), v.minLength(1, "Refresh token cannot be empty")),
});

export const ActivateAccountSchema = v.object({
  token: v.pipe(v.string("Activation token is required"), v.minLength(1, "Activation token cannot be empty")),
});

export const ForgotPasswordSchema = v.object({
  email: v.pipe(v.string("Email is required"), v.email("Invalid email format")),
});

export const ResetPasswordSchema = v.object({
  token: v.pipe(v.string("Reset token is required"), v.minLength(1, "Reset token cannot be empty")),
  newPassword: v.pipe(
    v.string("New password is required"),
    v.minLength(8, "Password must be at least 8 characters"),
    v.maxLength(255, "Password is too long"),
  ),
});

export const TokenResponseSchema = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
});

export const MessageResponseSchema = v.object({
  message: v.string(),
});

export const ErrorResponseSchema = v.object({
  error: v.string(),
});

export const loginDocs = describeRoute({
  tags: ["Auth"],
  summary: "Login with email and password",
  description: "Authenticates a user and returns access + refresh tokens.",
  responses: {
    200: {
      description: "Successful login",
      content: {
        "application/json": { schema: resolver(TokenResponseSchema) },
      },
    },
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
    403: {
      description: "Account not activated",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
  },
});

export const registerDocs = describeRoute({
  tags: ["Auth"],
  summary: "Register a new user",
  description: "Creates a new user account and dispatches an activation email.",
  responses: {
    201: {
      description: "User registered successfully",
      content: {
        "application/json": { schema: resolver(MessageResponseSchema) },
      },
    },
    409: {
      description: "Username or email already exists",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
  },
});

export const activateDocs = describeRoute({
  tags: ["Auth"],
  summary: "Activate account",
  description: "Verifies the email activation token and activates the user account.",
  responses: {
    200: {
      description: "Account successfully activated",
      content: {
        "application/json": { schema: resolver(MessageResponseSchema) },
      },
    },
    400: {
      description: "Invalid or expired token",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
  },
});

export const forgotPasswordDocs = describeRoute({
  tags: ["Auth"],
  summary: "Request password reset",
  description: "Generates a short-lived password reset token and dispatches a reset email.",
  responses: {
    200: {
      description: "If the email exists, a reset link has been sent",
      content: {
        "application/json": { schema: resolver(MessageResponseSchema) },
      },
    },
  },
});

export const resetPasswordDocs = describeRoute({
  tags: ["Auth"],
  summary: "Reset password",
  description: "Verifies the reset token and sets a new password.",
  responses: {
    200: {
      description: "Password reset successfully",
      content: {
        "application/json": { schema: resolver(MessageResponseSchema) },
      },
    },
    400: {
      description: "Invalid or expired token",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
  },
});

export const socialLoginDocs = describeRoute({
  tags: ["Auth"],
  summary: "Social login (Google/Github)",
  description: "Authenticates via a social provider ID token. Creates an account on first login.",
  responses: {
    200: {
      description: "Successful authentication",
      content: {
        "application/json": { schema: resolver(TokenResponseSchema) },
      },
    },
    401: {
      description: "Invalid or expired social token",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
    501: {
      description: "Provider not implemented",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
  },
});

export const refreshDocs = describeRoute({
  tags: ["Auth"],
  summary: "Refresh access token",
  description: "Rotates the refresh token and returns a new access + refresh token pair.",
  responses: {
    200: {
      description: "Tokens refreshed",
      content: {
        "application/json": { schema: resolver(TokenResponseSchema) },
      },
    },
    401: {
      description: "Invalid or expired token",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
    403: {
      description: "Token reuse detected — session terminated",
      content: {
        "application/json": { schema: resolver(ErrorResponseSchema) },
      },
    },
  },
});

export const logoutDocs = describeRoute({
  tags: ["Auth"],
  summary: "Logout",
  description: "Invalidates the entire token family associated with the active session.",
  responses: {
    200: {
      description: "Logged out successfully",
      content: {
        "application/json": { schema: resolver(MessageResponseSchema) },
      },
    },
  },
});
