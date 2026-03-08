// test/user.social.test.ts

import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { api, seed, cleanup, type SeededData } from "./setup";

let s: SeededData;

beforeAll(async () => {
    s = await seed();
});

afterAll(async () => {
    await cleanup();
});

const username = () => s.users.user.username;
const editorUsername = () => s.users.editor.username;
const badUsername = "this-user-does-not-exist-xyz";

describe("GET /v1/users", () => {
    it("returns 401 without auth", async () => {
        const res = await api.get("/v1/users");
        expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
        const res = await api.get("/v1/users", { token: s.users.user.token });
        expect(res.status).toBe(403);
    });

    it("returns a paginated list for admin", async () => {
        const res = await api.get("/v1/users", { token: s.users.admin.token });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.total).toBeNumber();
    });

    it("respects ?limit and ?page", async () => {
        const res = await api.get("/v1/users", { token: s.users.admin.token, query: { limit: "1", page: "1" } });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.length).toBeLessThanOrEqual(1);
    });

    it("respects ?fields to prune response", async () => {
        const res = await api.get("/v1/users", { token: s.users.admin.token, query: { fields: "id,username" } });
        expect(res.status).toBe(200);

        const body = await res.json();
        const user = body.data[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("username");
        expect(user).not.toHaveProperty("role");
    });

    it("respects ?include=profile", async () => {
        const res = await api.get("/v1/users", { token: s.users.admin.token, query: { include: "profile" } });
        expect(res.status).toBe(200);

        const body = await res.json();
        const user = body.data[0];
        expect(user).toHaveProperty("profile");
    });

    it("rejects invalid include", async () => {
        const res = await api.get("/v1/users", { token: s.users.admin.token, query: { include: "secrets" } });
        expect(res.status).toBe(400);
    });

    it("supports ?search by username", async () => {
        const res = await api.get("/v1/users", { token: s.users.admin.token, query: { search: "test-user" } });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("does not leak passwordHash", async () => {
        const res = await api.get("/v1/users", { token: s.users.admin.token });
        const body = await res.json();
        const user = body.data[0];
        expect(user).not.toHaveProperty("passwordHash");
    });
});

describe("GET /v1/users/:username", () => {
    it("returns a public profile", async () => {
        const res = await api.get(`/v1/users/${username()}`);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.username).toBe(username());
        expect(body.data).toHaveProperty("id");
        expect(body.data).toHaveProperty("role");
        expect(body.data).toHaveProperty("createdAt");
    });

    it("does not leak passwordHash or email", async () => {
        const res = await api.get(`/v1/users/${username()}`);
        const body = await res.json();
        expect(body.data).not.toHaveProperty("passwordHash");
        expect(body.data).not.toHaveProperty("email");
    });

    it("respects ?fields", async () => {
        const res = await api.get(`/v1/users/${username()}`, { query: { fields: "id,username" } });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toHaveProperty("id");
        expect(body.data).toHaveProperty("username");
        expect(body.data).not.toHaveProperty("role");
    });

    it("respects ?include=profile", async () => {
        const res = await api.get(`/v1/users/${username()}`, { query: { include: "profile" } });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toHaveProperty("profile");
    });

    it("returns 404 for non-existent user", async () => {
        const res = await api.get(`/v1/users/${badUsername}`);
        expect(res.status).toBe(404);
    });

    it("works without auth (public)", async () => {
        const res = await api.get(`/v1/users/${username()}`);
        expect(res.status).toBe(200);
    });
});

// ═════════════════════════════════════════════════════════════
//  GET /v1/users/:username/followers
// ═════════════════════════════════════════════════════════════

describe("GET /v1/users/:username/followers", () => {
    it("returns paginated followers", async () => {
        const res = await api.get(`/v1/users/${username()}/followers`);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.total).toBeNumber();
        // editor and admin follow user (seeded)
        expect(body.total).toBeGreaterThanOrEqual(2);
    });

    it("only returns follow status (not blocks)", async () => {
        const res = await api.get(`/v1/users/${username()}/followers`);
        const body = await res.json();

        // moderator blocks user — should NOT appear in followers
        const followerIds = body.data.map((f: any) => f.follower?.id ?? f.followerId);
        expect(followerIds).not.toContain(s.users.moderator.id);
    });

    it("respects ?include=follower", async () => {
        const res = await api.get(`/v1/users/${username()}/followers`, {
            query: { include: "follower" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data[0]).toHaveProperty("follower");
        expect(body.data[0].follower).toHaveProperty("username");
    });

    it("respects ?limit", async () => {
        const res = await api.get(`/v1/users/${username()}/followers`, {
            query: { limit: "1" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data.length).toBeLessThanOrEqual(1);
    });

    it("returns 404 for non-existent user", async () => {
        const res = await api.get(`/v1/users/${badUsername}/followers`);
        expect(res.status).toBe(404);
    });
});

describe("GET /v1/users/:username/following", () => {
    it("returns paginated following list", async () => {
        const res = await api.get(`/v1/users/${username()}/following`);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.total).toBeNumber();
        // user follows editor (seeded)
        expect(body.total).toBeGreaterThanOrEqual(1);
    });

    it("respects ?include=following", async () => {
        const res = await api.get(`/v1/users/${username()}/following`, {
            query: { include: "following" },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data[0]).toHaveProperty("following");
        expect(body.data[0].following).toHaveProperty("username");
    });

    it("returns 404 for non-existent user", async () => {
        const res = await api.get(`/v1/users/${badUsername}/following`);
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  POST /v1/users/:username/follow
// ═════════════════════════════════════════════════════════════

describe("POST /v1/users/:username/follow", () => {
    it("requires authentication", async () => {
        const res = await api.post(`/v1/users/${editorUsername()}/follow`);
        expect(res.status).toBe(401);
    });

    it("follows a user", async () => {
        // moderator follows editor (not seeded)
        const res = await api.post(`/v1/users/${editorUsername()}/follow`, {
            token: s.users.moderator.token,
        });
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.data).toHaveProperty("id");
        expect(body.data.status).toBe("follow");
    });

    it("upserts — calling again does not error", async () => {
        const res = await api.post(`/v1/users/${editorUsername()}/follow`, {
            token: s.users.moderator.token,
        });
        expect(res.status).toBe(201);
    });

    it("returns 400 when following yourself", async () => {
        const res = await api.post(`/v1/users/${username()}/follow`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent user", async () => {
        const res = await api.post(`/v1/users/${badUsername}/follow`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });
});


describe("DELETE /v1/users/:username/follow", () => {
    it("requires authentication", async () => {
        const res = await api.delete(`/v1/users/${editorUsername()}/follow`);
        expect(res.status).toBe(401);
    });

    it("unfollows a user", async () => {
        // moderator followed editor in the POST test above
        const res = await api.delete(`/v1/users/${editorUsername()}/follow`, {
            token: s.users.moderator.token,
        });
        expect(res.status).toBe(204);
    });

    it("returns 404 when not following", async () => {
        // moderator already unfollowed editor
        const res = await api.delete(`/v1/users/${editorUsername()}/follow`, {
            token: s.users.moderator.token,
        });
        expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent user", async () => {
        const res = await api.delete(`/v1/users/${badUsername}/follow`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════
//  POST /v1/users/:username/block
// ═════════════════════════════════════════════════════════════

describe("POST /v1/users/:username/block", () => {
    it("requires authentication", async () => {
        const res = await api.post(`/v1/users/${username()}/block`);
        expect(res.status).toBe(401);
    });

    it("blocks a user", async () => {
        // editor blocks admin (not seeded)
        const res = await api.post(`/v1/users/${s.users.admin.username}/block`, {
            token: s.users.editor.token,
        });
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.data.status).toBe("block");
    });

    it("returns 400 when blocking yourself", async () => {
        const res = await api.post(`/v1/users/${username()}/block`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent user", async () => {
        const res = await api.post(`/v1/users/${badUsername}/block`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });
});

describe("DELETE /v1/users/:username/block", () => {
    it("requires authentication", async () => {
        const res = await api.delete(`/v1/users/${username()}/block`);
        expect(res.status).toBe(401);
    });

    it("unblocks a user", async () => {
        // editor blocked admin in the POST test above
        const res = await api.delete(`/v1/users/${s.users.admin.username}/block`, {
            token: s.users.editor.token,
        });
        expect(res.status).toBe(204);
    });

    it("returns 404 when user is not blocked", async () => {
        // editor already unblocked admin
        const res = await api.delete(`/v1/users/${s.users.admin.username}/block`, {
            token: s.users.editor.token,
        });
        expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent user", async () => {
        const res = await api.delete(`/v1/users/${badUsername}/block`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });
});

describe("POST /v1/users/:username/friend-requests", () => {
    it("requires authentication", async () => {
        const res = await api.post(`/v1/users/${username()}/friend-requests`);
        expect(res.status).toBe(401);
    });

    it("sends a friend request", async () => {
        // moderator sends friend request to editor (not seeded)
        const res = await api.post(`/v1/users/${editorUsername()}/friend-requests`, {
            token: s.users.moderator.token,
        });
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.data).toHaveProperty("id");
        expect(body.data.status).toBe("pending");
        expect(body.data.requesterId).toBe(s.users.moderator.id);
        expect(body.data.requestedId).toBe(s.users.editor.id);
    });

    it("returns 400 for duplicate pending request", async () => {
        // moderator already sent a request to editor
        const res = await api.post(`/v1/users/${editorUsername()}/friend-requests`, {
            token: s.users.moderator.token,
        });
        expect(res.status).toBe(400);
    });

    it("returns 400 when sending to yourself", async () => {
        const res = await api.post(`/v1/users/${username()}/friend-requests`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(400);
    });

    it("returns 400 when already friends (accepted)", async () => {
        // admin → user is "accepted" (seeded)
        const res = await api.post(`/v1/users/${s.users.admin.username}/friend-requests`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent user", async () => {
        const res = await api.post(`/v1/users/${badUsername}/friend-requests`, {
            token: s.users.user.token,
        });
        expect(res.status).toBe(404);
    });
});