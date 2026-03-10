import * as v from "valibot";
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from "$src/utils";
import { postAuthors } from "$src/db/schema/posts";
import { getColumns } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import { PostIdentifierParamSchema } from "../schema";

const authorCols = getColumns(postAuthors);
type AuthorColumn = keyof typeof authorCols;

export const AUTHOR_FORBIDDEN_COLUMNS = new Set<AuthorColumn>(["postId"]);
export const AUTHOR_ALLOWED_INCLUDES = ["user"];
export const AUTHOR_UPDATABLE_FIELDS = new Set(["role", "position", "department", "displayOrder"]);

// ─── Params & Queries ───────────────────────────────────────

export const AuthorUserIdParamSchema = v.object({
    identifier: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
    userId: v.pipe(v.string(), v.transform(Number), v.integer()),
});

export const AuthorListQuerySchema = v.object({
    fields: createFieldsSchema(postAuthors, AUTHOR_FORBIDDEN_COLUMNS),
    include: createIncludesSchema(AUTHOR_ALLOWED_INCLUDES),
});

export const AddAuthorSchema = v.object({
    userId: v.pipe(v.number(), v.integer(), v.minValue(1)),
    role: v.optional(v.string(), "Writer"),
    position: v.optional(v.nullable(v.string())),
    department: v.optional(v.nullable(v.string())),
    displayOrder: v.optional(v.number(), 0),
});

export const UpdateAuthorSchema = v.partial(
    v.object({
        role: v.string(),
        position: v.nullable(v.string()),
        department: v.nullable(v.string()),
        displayOrder: v.number(),
    }),
);

// ─── Response Schemas ───────────────────────────────────────

const UserIncludeSchema = v.object({
    id: v.number(),
    username: v.string(),
    isFollowing: v.optional(v.boolean()),
    isFriends: v.optional(v.string()),
    mpxr: v.optional(v.number()),
    profile: v.optional(
        v.nullable(
            v.object({
                firstName: v.nullable(v.string()),
                lastName: v.nullable(v.string()),
                avatarUrl: v.nullable(v.string()),
                bio: v.nullable(v.string()),
            })
        )
    ),
});

export const PostAuthorRecordSchema = v.object({
    id: v.number(),
    userId: v.number(),
    role: v.nullable(v.string()),
    position: v.nullable(v.string()),
    department: v.nullable(v.string()),
    displayOrder: v.number(),
    createdAt: v.string(),
    user: v.optional(UserIncludeSchema),
});

// ─── OpenAPI Docs ───────────────────────────────────────────

const fieldsList = getAllowedFields(postAuthors, AUTHOR_FORBIDDEN_COLUMNS).join(", ");

export const listAuthorsDocs = describeRoute({
    tags: ["Posts", "Authors"],
    summary: "List Post Authors",
    description: `Returns a flat array of all authors attached to a post (Writers, Editors, etc).\n\nIf authenticated and \`?include=user\` is passed, the user object will dynamically include \`isFollowing\` and \`isFriends\` statuses.\n\nFields: ${fieldsList}`,
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(v.object({ data: v.array(PostAuthorRecordSchema) })) } },
        },
        404: { description: "Post not found" },
    },
});
export const addAuthorDocs = describeRoute({
    tags: ["Posts", "Authors"],
    summary: "Add Author",
    security: [{ bearerAuth: [] }],
    responses: {
        201: {
            description: "Created",
            content: { "application/json": { schema: resolver(v.object({ data: PostAuthorRecordSchema })) } },
        },
        403: { description: "Forbidden" },
        404: { description: "Post not found" },
        409: { description: "Author already added to post" },
    },
});

export const updateAuthorDocs = describeRoute({
    tags: ["Posts", "Authors"],
    summary: "Update Author",
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: "Updated",
            content: { "application/json": { schema: resolver(v.object({ data: PostAuthorRecordSchema })) } },
        },
        400: { description: "No valid fields to update" },
        403: { description: "Forbidden" },
        404: { description: "Author link not found" },
    },
});

export const removeAuthorDocs = describeRoute({
    tags: ["Posts", "Authors"],
    summary: "Remove Author",
    security: [{ bearerAuth: [] }],
    responses: {
        204: { description: "Removed" },
        403: { description: "Forbidden" },
        404: { description: "Author link not found" },
    },
});