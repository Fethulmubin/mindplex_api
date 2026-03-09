CREATE TABLE "post_media" (
	"id" serial PRIMARY KEY,
	"post_id" integer NOT NULL,
	"media_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"caption_override" varchar(500),
	CONSTRAINT "post_media_post_media_role_idx" UNIQUE("post_id","media_id","role")
);
--> statement-breakpoint
CREATE INDEX "post_media_post_id_idx" ON "post_media" ("post_id");--> statement-breakpoint
CREATE INDEX "post_media_media_id_idx" ON "post_media" ("media_id");--> statement-breakpoint
CREATE INDEX "post_media_post_role_idx" ON "post_media" ("post_id","role");--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_id_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE;