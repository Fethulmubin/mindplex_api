import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { validator } from "hono-openapi";
import { posts, postAuthors } from "$src/db/schema/posts";
import type { AppContext, IncludeConfig } from "$src/types";
import { buildFieldSelection, buildRelationalWith, getByIdOrSlug, sanitizeUpdates } from "$src/utils";
import { guard, isOwnerOrRole } from "$src/middleware/auth";
import { ACCESS } from "$src/db/schema";
import { PostIdentifierParamSchema } from "../schema";
import {
    AUTHOR_FORBIDDEN_COLUMNS,
    AUTHOR_UPDATABLE_FIELDS,
    AuthorListQuerySchema,
    AddAuthorSchema,
    UpdateAuthorSchema,
    AuthorUserIdParamSchema,
    listAuthorsDocs,
    addAuthorDocs,
    updateAuthorDocs,
    removeAuthorDocs,
} from "./schema";

const app = new Hono<AppContext>();

async function getPostForAuthors(db: AppContext["Variables"]["db"], identifier: string) {
    return db.query.posts.findFirst({
        where: getByIdOrSlug(posts, identifier).query,
        columns: { id: true, authorId: true },
    });
}

async function ensurePrimaryAuthorLink(db: AppContext["Variables"]["db"], post: { id: number; authorId: number }) {
    const existing = await db.query.postAuthors.findFirst({
        where: {
            AND: [{ postId: post.id }, { userId: post.authorId }],
        },
        columns: { id: true },
    });

    if (existing) return;

    await db.insert(postAuthors).values({
        postId: post.id,
        userId: post.authorId,
        role: "author",
        displayOrder: 0,
    });
}

const AUTHOR_INCLUDES: Record<string, IncludeConfig<"postAuthors">> = {
    user: {
        requiredRole: ACCESS.Public,
        drizzleWith: {
            user: {
                columns: { id: true, username: true },
                with: {
                    profile: { columns: { firstName: true, lastName: true, avatarUrl: true, bio: true } },
                },
            },
        },
    },
} as const;

// GET /posts/:identifier/authors
app.get(
    "/",
    guard("optional"),
    listAuthorsDocs,
    validator("param", PostIdentifierParamSchema),
    validator("query", AuthorListQuerySchema),
    async (c) => {
        const db = c.get("db");
        const { identifier } = c.req.valid("param");
        const { fields, include = [] } = c.req.valid("query");
        const userRole = c.get("role");

        const post = await getPostForAuthors(db, identifier);

        if (!post) return c.json({ error: "Post not found" }, 404);

        await ensurePrimaryAuthorLink(db, post);

        const selection = buildFieldSelection(postAuthors, fields, AUTHOR_FORBIDDEN_COLUMNS, { id: true });
        const relationalWith = buildRelationalWith(include, AUTHOR_INCLUDES, userRole);

        const data = await db.query.postAuthors.findMany({
            where: { postId: post.id },
            columns: selection,
            with: relationalWith,
            orderBy: (pa, { asc }) => [asc(pa.displayOrder), asc(pa.id)],
        });

        return c.json({ data });
    }
);

// POST /posts/:identifier/authors
app.post(
    "/",
    guard("editor"),
    addAuthorDocs,
    validator("param", PostIdentifierParamSchema),
    validator("json", AddAuthorSchema),
    async (c) => {
        const db = c.get("db");
        const { identifier } = c.req.valid("param");
        const body = c.req.valid("json");

        const post = await getPostForAuthors(db, identifier);

        if (!post) return c.json({ error: "Post not found" }, 404);
        if (!isOwnerOrRole(c, post.authorId)) return c.json({ error: "Forbidden" }, 403);

        await ensurePrimaryAuthorLink(db, post);

        if (body.userId === post.authorId) {
            return c.json({ error: "Primary author is already attached to this post" }, 409);
        }

        try {
            const [created] = await db
                .insert(postAuthors)
                .values({
                    postId: post.id,
                    userId: body.userId,
                    role: body.role,
                    position: body.position,
                    department: body.department,
                    displayOrder: body.displayOrder,
                })
                .returning();

            return c.json({ data: created }, 201);
        } catch (error: any) {

            const isUnique =
                error?.code === "23505" ||
                error?.cause?.code === "23505" ||
                error?.cause?.cause?.code === "23505" ||
                error?.message?.includes("23505") ||
                error?.message?.includes("unique constraint");

            if (isUnique) {
                return c.json({ error: "This user is already an author on this post" }, 409);
            }
            throw error;
        }
    }
);

// PATCH /posts/:identifier/authors/:userId
app.patch(
    "/:userId",
    guard("editor"),
    updateAuthorDocs,
    validator("param", AuthorUserIdParamSchema),
    validator("json", UpdateAuthorSchema),
    async (c) => {
        const db = c.get("db");
        const { identifier, userId } = c.req.valid("param");
        const body = c.req.valid("json");

        const post = await getPostForAuthors(db, identifier);

        if (!post) return c.json({ error: "Post not found" }, 404);
        if (!isOwnerOrRole(c, post.authorId)) return c.json({ error: "Forbidden" }, 403);

        await ensurePrimaryAuthorLink(db, post);

        const sanitized = sanitizeUpdates(body, AUTHOR_UPDATABLE_FIELDS);
        if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

        const [updated] = await db
            .update(postAuthors)
            .set(sanitized)
            .where(and(eq(postAuthors.postId, post.id), eq(postAuthors.userId, userId)))
            .returning();

        if (!updated) return c.json({ error: "Author link not found" }, 404);

        return c.json({ data: updated });
    }
);

// DELETE /posts/:identifier/authors/:userId
app.delete(
    "/:userId",
    guard("editor"),
    removeAuthorDocs,
    validator("param", AuthorUserIdParamSchema),
    async (c) => {
        const db = c.get("db");
        const { identifier, userId } = c.req.valid("param");

        const post = await getPostForAuthors(db, identifier);

        if (!post) return c.json({ error: "Post not found" }, 404);
        if (!isOwnerOrRole(c, post.authorId)) return c.json({ error: "Forbidden" }, 403);

        if (userId === post.authorId) {
            return c.json({ error: "Primary author cannot be removed" }, 409);
        }

        const deleted = await db
            .delete(postAuthors)
            .where(and(eq(postAuthors.postId, post.id), eq(postAuthors.userId, userId)))
            .returning();

        if (deleted.length === 0) return c.json({ error: "Author link not found" }, 404);

        return c.body(null, 204);
    }
);

export default app;
