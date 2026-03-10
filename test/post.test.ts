import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { api, seed, cleanup, asRole, type SeededData } from "./setup";

let s: SeededData;

beforeAll(async () => {
  s = await seed();
});

afterAll(async () => {
  await cleanup();
});

describe("GET /v1/posts", () => {
  it("returns a list of posts", async () => {
    const res = await api.get("/v1/posts");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
  });

  it("respects ?limit and ?page", async () => {
    const res = await api.get("/v1/posts", {
      query: { limit: "1", page: "1" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(1);
  });

  it("respects ?fields to prune response", async () => {
    const res = await api.get("/v1/posts", { query: { fields: "id,title" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const post = body.data[0];
    expect(post).toHaveProperty("id");
    expect(post).toHaveProperty("title");
    expect(post).not.toHaveProperty("content");
  });

  it("respects ?include=authors", async () => {
    const res = await api.get("/v1/posts", { query: { include: "authors" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const post = body.data[0];
    expect(post).toHaveProperty("author");
  });

  it("rejects invalid include", async () => {
    const res = await api.get("/v1/posts", { query: { include: "secrets" } });

    expect(res.status).toBe(400);
  });
});

describe("GET /v1/posts/:identifier", () => {
  it("finds a post by slug", async () => {
    const slug = s.posts[0].slug;
    const res = await api.get(`/v1/posts/${slug}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.slug).toBe(slug);
  });

  it("finds a post by numeric ID", async () => {
    const id = s.posts[0].id;
    const res = await api.get(`/v1/posts/${id}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(id);
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await api.get("/v1/posts/this-slug-does-not-exist-xyz");

    expect(res.status).toBe(404);
  });

  it("works without auth (public)", async () => {
    const res = await api.get(`/v1/posts/${s.posts[0].slug}`);

    expect(res.status).toBe(200);
  });

  it("works with auth (optional)", async () => {
    const res = await api.get(`/v1/posts/${s.posts[0].slug}`, {
      token: s.users.user.token,
    });

    expect(res.status).toBe(200);
  });
});

describe("POST /v1/posts", () => {
  const createdSlugs: string[] = [];

  afterAll(async () => {
    for (const slug of createdSlugs) {
      await api.delete(`/v1/posts/${slug}`, { token: s.users.admin.token });
    }
  });

  it("requires auth", async () => {
    const res = await api.post("/v1/posts", {
      body: { title: "No Auth Post" },
    });

    expect(res.status).toBe(401);
  });

  it("rejects user role (below editor)", async () => {
    const res = await api.post("/v1/posts", {
      token: s.users.user.token,
      body: { title: "Not Allowed" },
    });

    expect(res.status).toBe(403);
  });

  it("creates a post with auto-generated slug", async () => {
    const res = await api.post("/v1/posts", {
      token: s.users.editor.token,
      body: { title: "My Test Post" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe("My Test Post");
    expect(body.data.slug).toBeString();
    expect(body.data.status).toBe("draft");
    createdSlugs.push(body.data.slug);
  });

  it("creates a post with explicit slug", async () => {
    const slug = "test-explicit-slug-post";
    const res = await api.post("/v1/posts", {
      token: s.users.editor.token,
      body: { title: "Explicit Slug", slug },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.slug).toBe(slug);
    createdSlugs.push(slug);
  });

  it("rejects duplicate slug", async () => {
    const slug = s.posts[0].slug;
    const res = await api.post("/v1/posts", {
      token: s.users.editor.token,
      body: { title: "Dupe", slug },
    });

    expect(res.status).toBe(409);
  });

  it("validates required fields", async () => {
    const res = await api.post("/v1/posts", {
      token: s.users.editor.token,
      body: {},
    });

    expect(res.status).toBe(400);
  });

  it("auto-stamps publishedAt when status is published", async () => {
    const res = await api.post("/v1/posts", {
      token: s.users.editor.token,
      body: { title: "Published Post", status: "published" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.publishedAt).toBeTruthy();
    createdSlugs.push(body.data.slug);
  });
});

describe("PATCH /v1/posts/:identifier", () => {
  it("requires auth", async () => {
    const res = await api.patch(`/v1/posts/${s.posts[0].slug}`, {
      body: { title: "Nope" },
    });

    expect(res.status).toBe(401);
  });

  it("rejects user role (below editor)", async () => {
    const slug = s.posts[0].slug;
    const res = await api.patch(`/v1/posts/${slug}`, {
      token: s.users.user.token,
      body: { title: "Not Allowed" },
    });

    expect(res.status).toBe(403);
  });

  it("owner (editor) can update their post", async () => {
    const slug = s.posts[1].slug; // owned by editor
    const res = await api.patch(`/v1/posts/${slug}`, {
      token: s.users.editor.token,
      body: { title: "Updated Title" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("Updated Title");
  });

  it("non-owner editor gets 403", async () => {
    const slug = s.posts[2].slug;
    const res = await api.patch(`/v1/posts/${slug}`, {
      token: s.users.editor.token,
      body: { title: "Hijack" },
    });

    expect(res.status).toBe(403);
  });

  it("admin can update any post", async () => {
    const slug = s.posts[1].slug;
    const res = await api.patch(`/v1/posts/${slug}`, {
      token: s.users.admin.token,
      body: { title: "Admin Override" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("Admin Override");
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await api.patch("/v1/posts/ghost-slug-xyz", {
      token: s.users.admin.token,
      body: { title: "Nope" },
    });

    expect(res.status).toBe(404);
  });

  it("rejects empty update body", async () => {
    const slug = s.posts[1].slug;
    const res = await api.patch(`/v1/posts/${slug}`, {
      token: s.users.editor.token,
      body: {},
    });

    expect(res.status).toBe(400);
  });

  it("ignores non-updatable fields like authorId", async () => {
    const slug = s.posts[1].slug;
    const res = await api.patch(`/v1/posts/${slug}`, {
      token: s.users.editor.token,
      body: { title: "Good Update", authorId: 9999 },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.authorId).not.toBe(9999);
  });
});

describe("DELETE /v1/posts/:identifier", () => {
  it("requires auth", async () => {
    const res = await api.delete(`/v1/posts/${s.posts[2].slug}`);

    expect(res.status).toBe(401);
  });

  it("non-owner gets 403", async () => {
    const slug = s.posts[1].slug;
    const res = await api.delete(`/v1/posts/${slug}`, {
      token: s.users.user.token,
    });

    expect(res.status).toBe(403);
  });

  it("owner can trash their post", async () => {
    const slug = s.posts[2].slug;
    const res = await api.delete(`/v1/posts/${slug}`, {
      token: s.users.admin.token,
    });

    expect(res.status).toBe(204);

    const check = await api.get(`/v1/posts/${slug}`);
    const body = await check.json();
    expect(body.data.status).toBe("trashed");
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await api.delete("/v1/posts/ghost-slug-xyz", {
      token: s.users.admin.token,
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /v1/posts — type filter", () => {
  it("filters by ?type=news", async () => {
    const res = await api.get("/v1/posts", { query: { type: "news" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    for (const post of body.data) {
      expect(post.type).toBe("news");
    }
  });

  it("filters by ?type=podcast", async () => {
    const res = await api.get("/v1/posts", { query: { type: "podcast" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    for (const post of body.data) {
      expect(post.type).toBe("podcast");
    }
  });

  it("rejects invalid type", async () => {
    const res = await api.get("/v1/posts", { query: { type: "invalid" } });
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/posts — status=published default", () => {
  it("never returns draft posts", async () => {
    const res = await api.get("/v1/posts", { query: { limit: "100" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    for (const post of body.data) {
      expect(post.status).toBe("published");
    }
  });

  it("draft post not returned even with type filter", async () => {
    const res = await api.get("/v1/posts", { query: { type: "news" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const slugs = body.data.map((p: any) => p.slug);
    expect(slugs).not.toContain("test-draft-hidden");
  });
});

describe("GET /v1/posts — sort=recent", () => {
  it("orders by publishedAt DESC", async () => {
    const res = await api.get("/v1/posts", { query: { sort: "recent", limit: "50" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const dates = body.data.map((p: any) => new Date(p.publishedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});

describe("GET /v1/posts — sort=popular", () => {
  it("orders by like count", async () => {
    const res = await api.get("/v1/posts", {
      query: { sort: "popular", include: "stats", limit: "50" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const counts = body.data.map((p: any) => p.stats?.likeCount ?? 0);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i]);
    }
  });

  it("auto-includes stats without explicit ?include=stats", async () => {
    const res = await api.get("/v1/posts", { query: { sort: "popular" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const withStats = body.data.filter((p: any) => p.stats);
    expect(withStats.length).toBeGreaterThan(0);
  });
});

describe("GET /v1/posts — sort=all (trending)", () => {
  it("returns results with time-decayed engagement", async () => {
    const res = await api.get("/v1/posts", { query: { sort: "all" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
    expect(body.data.length).toBeGreaterThan(0);
  });
});

describe("GET /v1/posts — sort=trending (fallback)", () => {
  it("falls back to publishedAt DESC", async () => {
    const res = await api.get("/v1/posts", { query: { sort: "trending", limit: "50" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const dates = body.data.map((p: any) => new Date(p.publishedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  it("rejects invalid sort value", async () => {
    const res = await api.get("/v1/posts", { query: { sort: "invalid" } });
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/posts — feed=editors-pick", () => {
  it("returns only the editors pick", async () => {
    const res = await api.get("/v1/posts", { query: { feed: "editors-pick" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("returns the correct seeded post", async () => {
    const res = await api.get("/v1/posts", { query: { feed: "editors-pick" } });

    expect(res.status).toBe(200);
    const body = await res.json();

    const slugs = body.data.map((p: any) => p.slug);
    expect(slugs).toContain("test-editors-pick");
  });
});

describe("GET /v1/posts — feed=peoples-choice", () => {
  it("orders by vote count", async () => {
    const res = await api.get("/v1/posts", {
      query: { feed: "peoples-choice", include: "stats" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const counts = body.data.map((p: any) => p.stats?.peoplesChoiceCount ?? 0);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i]);
    }
  });

  it("auto-includes stats", async () => {
    const res = await api.get("/v1/posts", { query: { feed: "peoples-choice" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const withStats = body.data.filter((p: any) => p.stats);
    expect(withStats.length).toBeGreaterThan(0);
  });

  it("rejects invalid feed value", async () => {
    const res = await api.get("/v1/posts", { query: { feed: "invalid" } });
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/posts — ?include=stats", () => {
  it("returns all engagement count fields", async () => {
    const res = await api.get("/v1/posts", { query: { include: "stats" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const withStats = body.data.filter((p: any) => p.stats);
    expect(withStats.length).toBeGreaterThan(0);

    const stat = withStats[0].stats;
    expect(stat).toHaveProperty("likeCount");
    expect(stat).toHaveProperty("dislikeCount");
    expect(stat).toHaveProperty("commentCount");
    expect(stat).toHaveProperty("shareCount");
    expect(stat).toHaveProperty("bookmarkCount");
    expect(stat).toHaveProperty("peoplesChoiceCount");
  });
});

describe("GET /v1/posts — combined params", () => {
  it("type + sort combine correctly", async () => {
    const res = await api.get("/v1/posts", {
      query: { type: "article", sort: "popular", include: "stats" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    for (const post of body.data) {
      expect(post.type).toBe("article");
    }
    const counts = body.data.map((p: any) => p.stats?.likeCount ?? 0);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i]);
    }
  });

  it("type + feed combine correctly", async () => {
    const res = await api.get("/v1/posts", {
      query: { type: "article", feed: "peoples-choice", include: "stats" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    for (const post of body.data) {
      expect(post.type).toBe("article");
    }
  });
});

describe("GET /v1/posts — trigger verification", () => {
  it("reactions reflected in post_stats", async () => {
    const res = await api.get("/v1/posts", { query: { include: "stats", limit: "100" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const popular = body.data.find((p: any) => p.slug === "test-popular-article");
    expect(popular).toBeDefined();
    expect(popular.stats).toBeDefined();
    expect(popular.stats.likeCount).toBeGreaterThanOrEqual(3);
  });

  it("peoples-choice votes reflected in post_stats", async () => {
    const res = await api.get("/v1/posts", { query: { include: "stats", limit: "100" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    const news = body.data.find((p: any) => p.slug === "test-news-post");
    expect(news).toBeDefined();
    expect(news.stats.peoplesChoiceCount).toBeGreaterThanOrEqual(3);
  });
});
