import { Hono } from "hono";
import { count, ilike, or, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext, IncludeConfig } from "$src/types";
import { buildFieldSelection, buildRelationalWith } from "$src/utils";
import { ACCESS, users } from "$src/db/schema";
import { guard } from "$src/middleware/auth";
import me from "./me";
import usernameRouter from "./username";
import { UserListQuerySchema, listUsersDocs, USER_FORBIDDEN_COLUMNS } from "./username/schema";

const app = new Hono<AppContext>();


const USER_LIST_INCLUDES: Record<string, IncludeConfig<"users">> = {
    profile: {
        requiredRole: ACCESS.Public,
        drizzleWith: {
            profile: {
                columns: { firstName: true, lastName: true, avatarUrl: true },
            },
        },
    },
} as const;


app.get(
    "/",
    guard("admin"),
    listUsersDocs,
    validator("query", UserListQuerySchema),
    async (c) => {
        const db = c.get("db");
        const { limit, page, fields, include = [], search } = c.req.valid("query");
        const userRole = c.get("role");

        const selection = buildFieldSelection(users, fields, USER_FORBIDDEN_COLUMNS, { id: true });
        const relationalWith = buildRelationalWith(include, USER_LIST_INCLUDES, userRole);

        const where = search
            ? { OR: [{ username: { ilike: `%${search}%` } }, { email: { ilike: `%${search}%` } }] }
            : { isActivated: true };

        const countWhere = search
            ? or(ilike(users.username, `%${search}%`), ilike(users.email, `%${search}%`))
            : eq(users.isActivated, true);

        const [data, [{ total }]] = await Promise.all([
            db.query.users.findMany({
                where,
                columns: selection,
                with: relationalWith,
                limit,
                offset: (page - 1) * limit,
            }),
            db.select({ total: count() }).from(users).where(countWhere),
        ]);

        return c.json({ data, total });
    },
);


app.route("/me", me);
app.route("/:username", usernameRouter);

export default app;
