ALTER TABLE "announcement_buffer" RENAME TO "announcements_buffer";--> statement-breakpoint
ALTER TABLE "announcements_buffer" DROP CONSTRAINT "announcement_buffer_announcement_id_unique";--> statement-breakpoint
ALTER TABLE "announcements_buffer" ADD CONSTRAINT "announcements_buffer_announcement_id_unique" UNIQUE("announcement_id");