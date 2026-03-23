import { AppContext } from "$src/types";
import { contactSubmissions, mailingListSubscribers, notifications, users } from "$src/db/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono-openapi";
import {
	ContactSubmissionSchema,
	NewsletterSubscribeSchema,
	NewsletterUnsubscribeQuerySchema,
	contactSubmissionDocs,
	newsletterSubscribeDocs,
	newsletterUnsubscribeDocs,
} from "./schema";
import { createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify } from "jose";
import { env } from "$env";

const app = new Hono<AppContext>();

const UNSUBSCRIBE_SECRET = new TextEncoder().encode(env.JWT_SECRET);

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

async function resolveEmailFromUnsubscribeToken(token: string): Promise<string | null> {
	try {
		const { payload } = await jwtVerify(token, UNSUBSCRIBE_SECRET);
		const email = typeof payload.email === "string" ? payload.email : null;
		if (!email || !isValidEmail(email)) return null;
		return normalizeEmail(email);
	} catch {
		const [encodedEmail, signature] = token.split(".");
		if (!encodedEmail || !signature) return null;

		const expectedSignature = createHmac("sha256", env.JWT_SECRET).update(encodedEmail).digest("hex");

		const signatureBuffer = Buffer.from(signature, "hex");
		const expectedBuffer = Buffer.from(expectedSignature, "hex");
		if (signatureBuffer.length !== expectedBuffer.length) return null;

		if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
			return null;
		}

		const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
		if (!isValidEmail(email)) return null;

		return normalizeEmail(email);
	}
}

// POST /mailing/newsletter
app.post("/newsletter", newsletterSubscribeDocs, validator("json", NewsletterSubscribeSchema), async (c) => {
	const db = c.get("db");
	const { email } = c.req.valid("json");
	const normalizedEmail = normalizeEmail(email);

	const [existingSubscriber] = await db
		.select({ id: mailingListSubscribers.id })
		.from(mailingListSubscribers)
		.where(eq(mailingListSubscribers.email, normalizedEmail))
		.limit(1);

	if (existingSubscriber) {
		await db
			.update(mailingListSubscribers)
			.set({
				isActive: true,
				unsubscribedAt: null,
				listType: "newsletter",
			})
			.where(eq(mailingListSubscribers.email, normalizedEmail));
	} else {
		await db.insert(mailingListSubscribers).values({
			email: normalizedEmail,
			listType: "newsletter",
			isActive: true,
		});
	}

	return c.json({ message: "Newsletter subscription successful" });
});

// DELETE /mailing/newsletter?token=...
app.delete(
	"/newsletter",
	newsletterUnsubscribeDocs,
	validator("query", NewsletterUnsubscribeQuerySchema),
	async (c) => {
		const db = c.get("db");
		const { token } = c.req.valid("query");

		const email = await resolveEmailFromUnsubscribeToken(token);
		if (!email) {
			return c.json({ error: "Invalid unsubscribe token" }, 400);
		}

		const [subscriber] = await db
			.select({ id: mailingListSubscribers.id })
			.from(mailingListSubscribers)
			.where(eq(mailingListSubscribers.email, email))
			.limit(1);

		if (!subscriber) {
			return c.json({ error: "Subscriber not found" }, 404);
		}

		await db
			.update(mailingListSubscribers)
			.set({
				isActive: false,
				unsubscribedAt: new Date(),
			})
			.where(eq(mailingListSubscribers.email, email));

		return c.json({ message: "Newsletter unsubscribed successfully" });
	},
);

// POST /mailing/contact
app.post("/contact", contactSubmissionDocs, validator("json", ContactSubmissionSchema), async (c) => {
	const db = c.get("db");
	const { firstName, lastName, email, message, feedback } = c.req.valid("json");
	const normalizedEmail = normalizeEmail(email);

	const formattedMessage = feedback ? `${message}\n\nFeedback:\n${feedback}` : message;

	await db.insert(contactSubmissions).values({
		firstName,
		lastName,
		email: normalizedEmail,
		message: formattedMessage,
	});

	const admins = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.role, "admin"), eq(users.isActivated, true)));

	if (admins.length > 0) {
		await db.insert(notifications).values(
			admins.map((admin) => ({
				userId: admin.id,
				type: "contact_submission",
				targetType: "contact",
				message: `New contact submission from ${firstName} ${lastName} <${normalizedEmail}>`,
			})),
		);
	}

	return c.json({ message: "Contact submission received" });
});

export default app;
