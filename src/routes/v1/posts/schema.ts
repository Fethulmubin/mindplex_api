import * as v from "valibot";
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from "$src/utils";
import { PaginationLimitSchema, PaginationPageSchema } from "$src/lib/validators";
import { POST_TYPE, posts } from "$src/db/schema";
import { getColumns } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";

const postsCol = getColumns(posts);
type PostColumn = keyof typeof postsCol;

export const FORBIDDEN_COLUMNS = new Set<PostColumn>(["commentEnabled"]);
export const ALLOWED_INCLUDES = ["authors", "categories", "stats", 'media'];

export const UPDATABLE_FIELDS = new Set([
  "title",
  "content",
  "excerpt",
  "featuredImageUrl",
  "status",
  "type",
  "estimatedReadingMinutes",
  "publishedAt",
]);
const POST_TYPE_VALUES = Object.values(POST_TYPE);

export const PostIdentifierParamSchema = v.object({
  identifier: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
});

export const PostListQuerySchema = v.object({
  limit: PaginationLimitSchema,
  page: PaginationPageSchema,
  fields: createFieldsSchema(posts, FORBIDDEN_COLUMNS),
  include: createIncludesSchema(ALLOWED_INCLUDES),
  type: v.optional(v.picklist(POST_TYPE_VALUES)),
  sort: v.optional(v.picklist(["all", "recent", "popular", "trending"]), "all"),
  feed: v.optional(v.picklist(["editors-pick", "peoples-choice"])),
});

export const PostDetailsQuerySchema = v.object({
  fields: createFieldsSchema(posts, FORBIDDEN_COLUMNS),
  include: createIncludesSchema(ALLOWED_INCLUDES),
});

// ─── Body Schemas ───────────────────────────────────────────

export const CreatePostSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
  slug: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
      v.maxLength(255),
    ),
  ),
  content: v.optional(v.string(), ""),
  excerpt: v.optional(v.string()),
  featuredImageUrl: v.optional(v.pipe(v.string(), v.url())),
  status: v.optional(v.picklist(["draft", "pending", "published", "scheduled"]), "draft"),
  type: v.optional(v.picklist(["article", "news", "page", "podcast", "video"]), "article"),
  estimatedReadingMinutes: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  publishedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export const UpdatePostSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(500))),
  content: v.optional(v.string()),
  excerpt: v.optional(v.string()),
  featuredImageUrl: v.optional(v.union([v.pipe(v.string(), v.url()), v.null()])),
  status: v.optional(v.picklist(["draft", "pending", "published", "scheduled", "archived", "trashed"])),
  type: v.optional(v.picklist(["article", "news", "page", "podcast", "video"])),
  estimatedReadingMinutes: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  publishedAt: v.optional(v.union([v.pipe(v.string(), v.isoTimestamp()), v.null()])),
});

// ─── Response Schemas ───────────────────────────────────────

const AuthorResponseSchema = v.object({ id: v.number(), username: v.string() });
const CategoryResponseSchema = v.object({
  id: v.number(),
  name: v.string(),
  type: v.string(),
  slug: v.string(),
});

export const PostRecordSchema = v.object({
  id: v.number(),
  title: v.optional(v.string()),
  slug: v.optional(v.string()),
  content: v.optional(v.string()),
  author: v.optional(AuthorResponseSchema),
  taxonomies: v.optional(v.array(CategoryResponseSchema)),
});

export const PostListResponseSchema = v.object({
  data: v.array(PostRecordSchema),
});

// ─── OpenAPI Docs ───────────────────────────────────────────

const fieldsList = getAllowedFields(posts, FORBIDDEN_COLUMNS).join(", ");

export const postListDocs = describeRoute({
  tags: ["Posts"],
  summary: "List Posts",
  description: [
    `Paginated post listing. Always filters by status=published.`,
    ``,
    `**Filters:** type (${POST_TYPE_VALUES.join(", ")})`,
    ``,
    `**Sort:** all (time-decayed engagement), recent (publishedAt DESC), popular (like_count DESC), trending (reserved for recommendation system)`,
    ``,
    `**Feeds:** editors-pick (single featured post), peoples-choice (ordered by vote count). Feed overrides sort.`,
    ``,
    `**Includes:** ${ALLOWED_INCLUDES.join(", ")}. Stats auto-included when sort=all, sort=popular, or feed=peoples-choice.`,
    ``,
    `**Fields:** ${fieldsList}`,
  ].join("\n"),
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": { schema: resolver(PostListResponseSchema) },
      },
    },
  },
});

export const postDetailsDocs = describeRoute({
  tags: ["Posts"],
  summary: "Get Post by Slug",
  description: `Single post. Includes: ${ALLOWED_INCLUDES.join(", ")}. Fields: ${fieldsList}`,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(PostRecordSchema) } },
    },
    404: { description: "Not found" },
  },
});

export const createPostDocs = describeRoute({
  tags: ["Posts"],
  summary: "Create Post",
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: resolver(PostRecordSchema) } },
    },
    409: { description: "Slug conflict" },
  },
});

export const updatePostDocs = describeRoute({
  tags: ["Posts"],
  summary: "Update Post",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Updated",
      content: { "application/json": { schema: resolver(PostRecordSchema) } },
    },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

export const deletePostDocs = describeRoute({
  tags: ["Posts"],
  summary: "Trash Post",
  security: [{ bearerAuth: [] }],
  responses: {
    204: { description: "Trashed" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});
