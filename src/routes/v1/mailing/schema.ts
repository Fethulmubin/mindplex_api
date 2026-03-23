import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

export const NewsletterSubscribeSchema = v.object({
	email: v.pipe(v.string("Email is required"), v.email("Invalid email format")),
});

export const NewsletterUnsubscribeQuerySchema = v.object({
	token: v.pipe(v.string("Token is required"), v.minLength(1, "Token cannot be empty")),
});

export const ContactSubmissionSchema = v.object({
	firstName: v.pipe(v.string("First name is required"), v.minLength(1), v.maxLength(100)),
	lastName: v.pipe(v.string("Last name is required"), v.minLength(1), v.maxLength(100)),
	email: v.pipe(v.string("Email is required"), v.email("Invalid email format"), v.maxLength(255)),
	message: v.pipe(v.string("Message is required"), v.minLength(1), v.maxLength(5000)),
	feedback: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2000))),
});

export const MessageResponseSchema = v.object({
	message: v.string(),
});

export const ErrorResponseSchema = v.object({
	error: v.string(),
});

export const newsletterSubscribeDocs = describeRoute({
	tags: ["Mailing"],
	summary: "Newsletter Subscribe",
	description: "Subscribes an email to the newsletter list. Re-activates an existing subscriber.",
	responses: {
		200: {
			description: "Subscription successful",
			content: {
				"application/json": { schema: resolver(MessageResponseSchema) },
			},
		},
		400: {
			description: "Validation error",
			content: {
				"application/json": { schema: resolver(ErrorResponseSchema) },
			},
		},
	},
});

export const newsletterUnsubscribeDocs = describeRoute({
	tags: ["Mailing"],
	summary: "Newsletter Unsubscribe",
	description: "Unsubscribes an email using a signed token.",
	responses: {
		200: {
			description: "Unsubscribed successfully",
			content: {
				"application/json": { schema: resolver(MessageResponseSchema) },
			},
		},
		400: {
			description: "Invalid token",
			content: {
				"application/json": { schema: resolver(ErrorResponseSchema) },
			},
		},
		404: {
			description: "Subscriber not found",
			content: {
				"application/json": { schema: resolver(ErrorResponseSchema) },
			},
		},
	},
});

export const contactSubmissionDocs = describeRoute({
	tags: ["Mailing"],
	summary: "Contact Us",
	description: "Stores contact submissions and creates admin notifications.",
	responses: {
		200: {
			description: "Contact form submitted",
			content: {
				"application/json": { schema: resolver(MessageResponseSchema) },
			},
		},
		400: {
			description: "Validation error",
			content: {
				"application/json": { schema: resolver(ErrorResponseSchema) },
			},
		},
	},
});
