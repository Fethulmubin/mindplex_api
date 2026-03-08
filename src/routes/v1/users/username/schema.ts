import * as v from "valibot";
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from "$src/utils";
import { PaginationLimitSchema, PaginationPageSchema } from "$src/lib/validators";
import { users, follows } from "$src/db/schema";
import { getColumns } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";


const usersCols = getColumns(users);
type UserColumn = keyof typeof usersCols;

export const USER_FORBIDDEN_COLUMNS = new Set<UserColumn>(["passwordHash", "email"]);
export const USER_ALLOWED_INCLUDES = ["profile"];

const followsCols = getColumns(follows);
type FollowColumn = keyof typeof followsCols;

export const FOLLOW_FORBIDDEN_COLUMNS = new Set<FollowColumn>(["followerId", "followingId"]);
export const FOLLOW_ALLOWED_INCLUDES = ["follower", "following"];

export const UsernameParamSchema = v.object({
    username: v.pipe(v.string(), v.minLength(1), v.maxLength(60)),
});


export const UserListQuerySchema = v.object({
    limit: PaginationLimitSchema,
    page: PaginationPageSchema,
    fields: createFieldsSchema(users, USER_FORBIDDEN_COLUMNS),
    include: createIncludesSchema(USER_ALLOWED_INCLUDES),
    search: v.optional(v.string()),
});

export const UserDetailsQuerySchema = v.object({
    fields: createFieldsSchema(users, USER_FORBIDDEN_COLUMNS),
    include: createIncludesSchema(USER_ALLOWED_INCLUDES),
});

export const FollowListQuerySchema = v.object({
    limit: PaginationLimitSchema,
    page: PaginationPageSchema,
    fields: createFieldsSchema(follows, FOLLOW_FORBIDDEN_COLUMNS),
    include: createIncludesSchema(FOLLOW_ALLOWED_INCLUDES),
});

// ─── Response Schemas ───────────────────────────────────────

const PublicProfileSchema = v.object({
    id: v.number(),
    username: v.string(),
    role: v.string(),
    createdAt: v.string(),
    profile: v.optional(
        v.nullable(
            v.object({
                firstName: v.nullable(v.string()),
                lastName: v.nullable(v.string()),
                avatarUrl: v.nullable(v.string()),
                bio: v.nullable(v.string()),
            }),
        ),
    ),
});

const UserListItemSchema = v.object({
    id: v.number(),
    username: v.string(),
    role: v.string(),
    createdAt: v.string(),
    profile: v.optional(
        v.nullable(
            v.object({
                firstName: v.nullable(v.string()),
                lastName: v.nullable(v.string()),
                avatarUrl: v.nullable(v.string()),
            }),
        ),
    ),
});

const FollowRecordSchema = v.object({
    id: v.number(),
    status: v.string(),
    createdAt: v.string(),
});

const FriendRequestRecordSchema = v.object({
    id: v.number(),
    requesterId: v.number(),
    requestedId: v.number(),
    status: v.string(),
    createdAt: v.string(),
});

function paginatedResponse(itemSchema: v.GenericSchema) {
    return v.object({ data: v.array(itemSchema), total: v.number() });
}

// ─── OpenAPI Docs ───────────────────────────────────────────

const userFieldsList = getAllowedFields(users, USER_FORBIDDEN_COLUMNS).join(", ");
const followFieldsList = getAllowedFields(follows, FOLLOW_FORBIDDEN_COLUMNS).join(", ");

// List Users (admin only)
export const listUsersDocs = describeRoute({
    tags: ["Admin"],
    summary: "List Users (Admin)",
    security: [{ bearerAuth: [] }],
    description: [
        `Admin-only user directory. Returns a paginated list of all users.`,
        `Supports \`?search=\` to filter by username or email.`,
        ``,
        `**Includes:** ${USER_ALLOWED_INCLUDES.join(", ")}.`,
        ``,
        `**Fields:** ${userFieldsList}`,
    ].join("\n"),
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": { schema: resolver(paginatedResponse(UserListItemSchema)) },
            },
        },
        401: { description: "Not authenticated" },
        403: { description: "Admin access required" },
    },
});

// Public Profile
export const getPublicProfileDocs = describeRoute({
    tags: ["Users"],
    summary: "Get Public Profile",
    description: `Returns a user's public profile by username. No authentication required.\n\nIncludes: ${USER_ALLOWED_INCLUDES.join(", ")}. Fields: ${userFieldsList}`,
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(v.object({ data: PublicProfileSchema })) } },
        },
        404: { description: "User not found" },
    },
});

// Followers
export const listFollowersDocs = describeRoute({
    tags: ["Social"],
    summary: "List Followers",
    description: `Paginated list of users who follow the specified user. No authentication required.\n\nIncludes: ${FOLLOW_ALLOWED_INCLUDES.join(", ")}. Fields: ${followFieldsList}`,
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(paginatedResponse(FollowRecordSchema)) } },
        },
        404: { description: "User not found" },
    },
});

// Following
export const listFollowingDocs = describeRoute({
    tags: ["Social"],
    summary: "List Following",
    description: `Paginated list of users the specified user is following. No authentication required.\n\nIncludes: ${FOLLOW_ALLOWED_INCLUDES.join(", ")}. Fields: ${followFieldsList}`,
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(paginatedResponse(FollowRecordSchema)) } },
        },
        404: { description: "User not found" },
    },
});

// Follow
export const followUserDocs = describeRoute({
    tags: ["Social"],
    summary: "Follow User",
    security: [{ bearerAuth: [] }],
    description: "Follow the specified user. Upserts — if already blocked, switches to follow.",
    responses: {
        201: {
            description: "Followed",
            content: { "application/json": { schema: resolver(v.object({ data: FollowRecordSchema })) } },
        },
        400: { description: "Cannot follow yourself" },
        401: { description: "Not authenticated" },
        404: { description: "User not found" },
    },
});

// Unfollow
export const unfollowUserDocs = describeRoute({
    tags: ["Social"],
    summary: "Unfollow User",
    security: [{ bearerAuth: [] }],
    description: "Removes the follow relationship with the specified user.",
    responses: {
        204: { description: "Unfollowed" },
        401: { description: "Not authenticated" },
        404: { description: "Not following this user" },
    },
});

// Block
export const blockUserDocs = describeRoute({
    tags: ["Social"],
    summary: "Block User",
    security: [{ bearerAuth: [] }],
    description: "Block the specified user. Upserts — if already following, switches to block.",
    responses: {
        201: {
            description: "Blocked",
            content: { "application/json": { schema: resolver(v.object({ data: FollowRecordSchema })) } },
        },
        400: { description: "Cannot block yourself" },
        401: { description: "Not authenticated" },
        404: { description: "User not found" },
    },
});

// Unblock
export const unblockUserDocs = describeRoute({
    tags: ["Social"],
    summary: "Unblock User",
    security: [{ bearerAuth: [] }],
    description: "Removes the block on the specified user.",
    responses: {
        204: { description: "Unblocked" },
        401: { description: "Not authenticated" },
        404: { description: "User is not blocked" },
    },
});


export const sendFriendRequestDocs = describeRoute({
    tags: ["Social"],
    summary: "Send Friend Request",
    security: [{ bearerAuth: [] }],
    description: "Sends a friend request to the specified user. Fails if a request already exists in either direction or users are already friends.",
    responses: {
        201: {
            description: "Request sent",
            content: { "application/json": { schema: resolver(v.object({ data: FriendRequestRecordSchema })) } },
        },
        400: { description: "Cannot send to yourself, pending request exists, or already friends" },
        401: { description: "Not authenticated" },
        404: { description: "User not found" },
    },
});