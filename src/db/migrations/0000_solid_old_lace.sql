CREATE TABLE "announcement_buffer" (
	"id" serial PRIMARY KEY NOT NULL,
	"announcement_id" integer NOT NULL,
	"refreshed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_buffer_announcement_id_unique" UNIQUE("announcement_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"filters" text[] DEFAULT '{"all"}' NOT NULL,
	CONSTRAINT "announcement_subscriptions_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"blocked_at" timestamp,
	CONSTRAINT "users_chat_id_unique" UNIQUE("chat_id")
);
