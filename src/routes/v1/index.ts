import { Hono } from "hono";

import auth from "./auth";
import post from "./posts";
import comment from "./comments";
import users from "./users";
import mailing from "./mailing";

const v1 = new Hono();

v1.route("/auth", auth);
v1.route("/posts", post);
v1.route("/comments", comment);
v1.route("/users", users);
v1.route("/mailing", mailing);

export default v1;
