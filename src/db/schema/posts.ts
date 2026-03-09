import { pgTable, serial, varchar, text, jsonb, boolean, timestamp, integer, unique, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { PostMediaRole, PostStatus, PostType } from "./types";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    content: text("content").notNull().default(""),
    excerpt: text("excerpt").default(""),

    status: varchar("status", { length: 20 }).$type<PostStatus>().default("draft").notNull(),
    type: varchar("type", { length: 20 }).$type<PostType>().default("article").notNull(),
    commentEnabled: boolean("comment_enabled").default(true).notNull(),
    originResource: varchar("origin_resource", { length: 50 }),
    isEditorsPick: boolean("is_editors_pick").default(false).notNull(),

    estimatedReadingMinutes: integer("estimated_reading_minutes"),
    viewCount: integer("view_count").default(0).notNull(),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("posts_author_id_idx").on(table.authorId),
    index("posts_status_idx").on(table.status),
    index("posts_type_idx").on(table.type),
    index("posts_slug_idx").on(table.slug),
    index("posts_published_at_idx").on(table.publishedAt),
    index("posts_status_type_published_idx").on(table.status, table.type, table.publishedAt),
  ],
);

export const postAuthors = pgTable(
  "post_authors",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 100 }).default("author"),
    position: varchar("position", { length: 255 }),
    department: varchar("department", { length: 255 }),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("post_authors_post_user_idx").on(table.postId, table.userId),
    index("post_authors_user_id_idx").on(table.userId),
  ],
);

export const postStats = pgTable("post_stats", {
  postId: integer("post_id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  likeCount: integer("like_count").default(0).notNull(),
  dislikeCount: integer("dislike_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  shareCount: integer("share_count").default(0).notNull(),
  bookmarkCount: integer("bookmark_count").default(0).notNull(),
  peoplesChoiceCount: integer("peoples_choice_count").default(0).notNull(),
});


export const postMedia = pgTable(
  "post_media",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    mediaId: integer("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 })
      .$type<PostMediaRole>()
      .notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    captionOverride: varchar("caption_override", { length: 500 }),
  },
  (table) => [

    index("post_media_post_id_idx").on(table.postId),
    index("post_media_media_id_idx").on(table.mediaId),
    index("post_media_post_role_idx").on(table.postId, table.role),
    unique("post_media_post_media_role_idx").on(table.postId, table.mediaId, table.role),
  ],
);

// ============================================================================
// Media (replaces WP attachment post type)
// ============================================================================

export const media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    uploaderId: integer("uploader_id").references(() => users.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    altText: text("alt_text"),
    caption: text("caption"),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("media_uploader_id_idx").on(table.uploaderId)],
);
