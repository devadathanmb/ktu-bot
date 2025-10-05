-- Step 1: Drop the unique constraint on chat_id
ALTER TABLE "chats" DROP CONSTRAINT "chats_chat_id_unique";--> statement-breakpoint

-- Step 2: Drop the old serial PK constraint (still named users_pkey from migration 0001)
ALTER TABLE "chats" DROP CONSTRAINT "users_pkey";--> statement-breakpoint

-- Step 3: Drop the old serial id column
ALTER TABLE "chats" DROP COLUMN "id";--> statement-breakpoint

-- Step 4: Rename chat_id to id
ALTER TABLE "chats" RENAME COLUMN "chat_id" TO "id";--> statement-breakpoint

-- Step 5: Make id the new primary key
ALTER TABLE "chats" ADD PRIMARY KEY ("id");--> statement-breakpoint

-- Step 6: Add FK constraint from announcement_subscriptions to chats
ALTER TABLE "announcement_subscriptions" ADD CONSTRAINT "announcement_subscriptions_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;
