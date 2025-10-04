ALTER TABLE "users" RENAME TO "chats";--> statement-breakpoint
ALTER TABLE "chats" RENAME COLUMN "blocked_at" TO "kicked_at";--> statement-breakpoint
ALTER TABLE "chats" DROP CONSTRAINT "users_chat_id_unique";--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_chat_id_unique" UNIQUE("chat_id");