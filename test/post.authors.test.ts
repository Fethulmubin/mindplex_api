import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { db } from "$src/db/client";
import * as schema from "$src/db/schema";
import { eq } from "drizzle-orm";
import { api, seed, cleanup, type SeededData } from "./setup";

let s: SeededData;

beforeAll(async () => {
    s = await seed();
});

afterAll(async () => {
    await cleanup();
});

const badSlug = "this-post-does-not-exist-999";

// ═════════════════════════════════════════════════════════════
//  GET /v1/posts/:identifier/authors
// ═════════════════════════════════════════════════════════════

describe("GET /v1/posts/:identifier/authors", () => {
    it("returns authors for a valid post", async () => {
        // s.posts[0] definitely has an author (the owner)
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/authors`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toBeArray();
    });

    it("respects ?fields to prune response", async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/authors`, {
            query: { fields: "id,role" },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        if (body.data.length > 0) {
            const authorLink = body.data[0];
            expect(authorLink).toHaveProperty("id");
            expect(authorLink).toHaveProperty("role");
            expect(authorLink).not.toHaveProperty("department");
        }
    });

    it("respects ?include=user", async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/authors`, {
            query: { include: "user" },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        if (body.data.length > 0) {
            const authorLink = body.data[0];
            expect(authorLink).toHaveProperty("user");
            expect(authorLink.user).toHaveProperty("id");
            expect(authorLink.user).toHaveProperty("username");
        }
    });

    it("returns 404 for non-existent post", async () => {
        const res = await api.get(`/v1/posts/${badSlug}/authors`);
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  POST /v1/posts/:identifier/authors
// ═════════════════════════════════════════════════════════════

describe("POST /v1/posts/:identifier/authors", () => {
    it("requires authentication", async () => {
        const res = await api.post(`/v1/posts/${s.posts[1].slug}/authors`, {
            body: { userId: s.users.moderator.id },
        });
        expect(res.status).toBe(401);
    });

    it("returns 403 when a regular user tries to add an author", async () => {
        const res = await api.post(`/v1/posts/${s.posts[1].slug}/authors`, {
            token: s.users.user.token,
            body: { userId: s.users.moderator.id },
        });
        expect(res.status).toBe(403);
    });

    it("returns 403 when a non-owner editor tries to add an author", async () => {
        // s.posts[2] is owned by admin. The editor doesn't own it.
        const res = await api.post(`/v1/posts/${s.posts[2].slug}/authors`, {
            token: s.users.editor.token,
            body: { userId: s.users.user.id },
        });
        expect(res.status).toBe(403);
    });

    it("allows post owner (editor) to add a co-author", async () => {
        // s.posts[1] is owned by the editor.
        const res = await api.post(`/v1/posts/${s.posts[1].slug}/authors`, {
            token: s.users.editor.token,
            body: {
                userId: s.users.moderator.id,
                role: "Co-Writer",
                displayOrder: 1
            },
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.userId).toBe(s.users.moderator.id);
        expect(body.data.role).toBe("Co-Writer");
    });

    it("returns 409 if author is already linked to the post", async () => {
        const res = await api.post(`/v1/posts/${s.posts[1].slug}/authors`, {
            token: s.users.editor.token,
            body: { userId: s.users.moderator.id }, // Already added in the test above
        });
        expect(res.status).toBe(409);
    });

    it("returns 404 for non-existent post", async () => {
        const res = await api.post(`/v1/posts/${badSlug}/authors`, {
            token: s.users.admin.token,
            body: { userId: s.users.user.id },
        });
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  PATCH /v1/posts/:identifier/authors/:userId
// ═════════════════════════════════════════════════════════════

describe("PATCH /v1/posts/:identifier/authors/:userId", () => {
    it("requires authentication", async () => {
        const res = await api.patch(`/v1/posts/${s.posts[1].slug}/authors/${s.users.moderator.id}`, {
            body: { role: "Updated Role" },
        });
        expect(res.status).toBe(401);
    });

    it("allows owner to update an author's metadata", async () => {
        const res = await api.patch(`/v1/posts/${s.posts[1].slug}/authors/${s.users.moderator.id}`, {
            token: s.users.editor.token,
            body: {
                role: "Lead Editor",
                department: "AI Research",
                displayOrder: 5
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.role).toBe("Lead Editor");
        expect(body.data.department).toBe("AI Research");
        expect(body.data.displayOrder).toBe(5);
    });

    it("validates empty body", async () => {
        const res = await api.patch(`/v1/posts/${s.posts[1].slug}/authors/${s.users.moderator.id}`, {
            token: s.users.editor.token,
            body: {},
        });
        expect(res.status).toBe(400);
    });

    it("returns 404 if user is not currently an author on the post", async () => {
        // Admin was never added as a co-author to posts[1]
        const res = await api.patch(`/v1/posts/${s.posts[1].slug}/authors/${s.users.admin.id}`, {
            token: s.users.editor.token,
            body: { role: "Ghost Writer" },
        });
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  DELETE /v1/posts/:identifier/authors/:userId
// ═════════════════════════════════════════════════════════════

describe("DELETE /v1/posts/:identifier/authors/:userId", () => {
    it("requires authentication", async () => {
        const res = await api.delete(`/v1/posts/${s.posts[1].slug}/authors/${s.users.moderator.id}`);
        expect(res.status).toBe(401);
    });

    it("allows owner to remove a co-author", async () => {
        const res = await api.delete(`/v1/posts/${s.posts[1].slug}/authors/${s.users.moderator.id}`, {
            token: s.users.editor.token,
        });

        expect(res.status).toBe(204);

        // Verify they are gone
        const check = await api.patch(`/v1/posts/${s.posts[1].slug}/authors/${s.users.moderator.id}`, {
            token: s.users.editor.token,
            body: { role: "Still Here?" },
        });
        expect(check.status).toBe(404);
    });

    it("returns 404 when trying to delete an author that doesn't exist on the post", async () => {
        const res = await api.delete(`/v1/posts/${s.posts[1].slug}/authors/${s.users.admin.id}`, {
            token: s.users.editor.token,
        });
        expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent post", async () => {
        const res = await api.delete(`/v1/posts/${badSlug}/authors/${s.users.user.id}`, {
            token: s.users.admin.token,
        });
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  Co-Author Edge Cases
// ═════════════════════════════════════════════════════════════

describe("Co-author edge cases", () => {
    it("auto-links the primary author on list", async () => {
        const post = s.posts[3];

        await db.delete(schema.postAuthors).where(eq(schema.postAuthors.postId, post.id));

        const res = await api.get(`/v1/posts/${post.slug}/authors`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const primary = body.data.find((a: any) => a.userId === post.authorId);

        expect(primary).toBeTruthy();
        expect(primary.role).toBe("author");
        expect(primary.displayOrder).toBe(0);
    });

    it("returns 409 when trying to add the primary author", async () => {
        const post = s.posts[3];

        const res = await api.post(`/v1/posts/${post.slug}/authors`, {
            token: s.users.editor.token,
            body: { userId: post.authorId },
        });

        expect(res.status).toBe(409);
    });

    it("returns 409 when trying to remove the primary author", async () => {
        const post = s.posts[3];

        const res = await api.delete(`/v1/posts/${post.slug}/authors/${post.authorId}`, {
            token: s.users.editor.token,
        });

        expect(res.status).toBe(409);
    });

    it("orders authors by displayOrder, then id", async () => {
        const post = s.posts[3];

        await db.delete(schema.postAuthors).where(eq(schema.postAuthors.postId, post.id));

        await api.get(`/v1/posts/${post.slug}/authors`);

        const addFirst = await api.post(`/v1/posts/${post.slug}/authors`, {
            token: s.users.editor.token,
            body: { userId: s.users.moderator.id, role: "Contributor", displayOrder: 2 },
        });
        expect(addFirst.status).toBe(201);

        const addSecond = await api.post(`/v1/posts/${post.slug}/authors`, {
            token: s.users.editor.token,
            body: { userId: s.users.user.id, role: "Contributor", displayOrder: 1 },
        });
        expect(addSecond.status).toBe(201);

        const res = await api.get(`/v1/posts/${post.slug}/authors`);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.length).toBe(3);

        expect(body.data[0].userId).toBe(post.authorId);
        expect(body.data[1].userId).toBe(s.users.user.id);
        expect(body.data[2].userId).toBe(s.users.moderator.id);
    });
});
