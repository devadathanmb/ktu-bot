CREATE TABLE "academic_calendars" (
	"id" integer PRIMARY KEY NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"attachment" jsonb NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("academic_calendars"."title", ''))) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" integer PRIMARY KEY NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english',
          coalesce("announcements"."subject", '') || ' ' ||
          coalesce("announcements"."message", '')
        )) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_timetables" (
	"id" integer PRIMARY KEY NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"attachment" jsonb NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("exam_timetables"."title", ''))) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements_buffer" ALTER COLUMN "refreshed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcements_buffer" ALTER COLUMN "refreshed_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "announcement_subscriptions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcement_subscriptions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "announcement_subscriptions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcement_subscriptions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "kicked_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
CREATE INDEX "academic_calendars_search_idx" ON "academic_calendars" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "academic_calendars_published_at_idx" ON "academic_calendars" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "announcements_search_idx" ON "announcements" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "announcements_published_at_idx" ON "announcements" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "exam_timetables_search_idx" ON "exam_timetables" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "exam_timetables_published_at_idx" ON "exam_timetables" USING btree ("published_at" DESC NULLS LAST);