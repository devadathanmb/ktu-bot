import { BotContext } from "../../types/bot.types.js";
import { NextFunction } from "grammy";
import logger from "../../utils/logger.js";
import { getMediaType, getUpdateType } from "../../utils/bot.js";

const MAX_TEXT_LOG_LENGTH = 100;
const MAX_QUERY_LOG_LENGTH = 50;

async function logging(ctx: BotContext, next: NextFunction): Promise<void> {
  const start = Date.now();

  const updateType = getUpdateType(ctx.update);

  const logData: Record<string, unknown> = {
    update_id: ctx.update.update_id,
    type: updateType,
    user_id: ctx.from?.id,
    username: ctx.from?.username,
    first_name: ctx.from?.first_name,
    last_name: ctx.from?.last_name,
    is_bot: ctx.from?.is_bot,
    is_premium: ctx.from?.is_premium,
    language_code: ctx.from?.language_code,
    chat_id: ctx.chat?.id,
    chat_type: ctx.chat?.type,
  };

  // Message-specific logging
  if (ctx.message) {
    Object.assign(logData, {
      message_id: ctx.message.message_id,
      text: ctx.message.text?.slice(0, MAX_TEXT_LOG_LENGTH),
      text_length: ctx.message.text?.length,
      command: ctx.message.text?.startsWith("/")
        ? ctx.message.text.split(" ")[0]
        : undefined,
      message_date: ctx.message.date,
      has_entities: (ctx.message.entities?.length ?? 0) > 0,
      entity_types: ctx.message.entities?.map(e => e.type),
      media_type: getMediaType(ctx.message),
      is_forwarded: !!ctx.message.forward_origin,
      is_reply: !!ctx.message.reply_to_message,
      reply_to_message_id: ctx.message.reply_to_message?.message_id,
      has_reply_markup: !!ctx.message.reply_markup,
    });
  }

  // Callback query logging
  if (ctx.callbackQuery) {
    Object.assign(logData, {
      callback_data: ctx.callbackQuery.data,
      callback_id: ctx.callbackQuery.id,
      message_id: ctx.callbackQuery.message?.message_id,
      inline_message_id: ctx.callbackQuery.inline_message_id,
    });
  }

  // Inline query logging
  if (ctx.inlineQuery) {
    Object.assign(logData, {
      query: ctx.inlineQuery.query?.slice(0, MAX_QUERY_LOG_LENGTH),
      query_length: ctx.inlineQuery.query?.length,
      inline_query_id: ctx.inlineQuery.id,
      offset: ctx.inlineQuery.offset,
      chat_type: ctx.inlineQuery.chat_type,
      location: ctx.inlineQuery.location ? "provided" : undefined,
    });
  }

  // Edited message logging
  if (ctx.editedMessage) {
    Object.assign(logData, {
      edited_message_id: ctx.editedMessage.message_id,
      edited_text: ctx.editedMessage.text?.slice(0, MAX_TEXT_LOG_LENGTH),
      edit_date: ctx.editedMessage.edit_date,
    });
  }

  // Chat member updates
  if (ctx.update.chat_member || ctx.update.my_chat_member) {
    const memberUpdate = ctx.update.chat_member || ctx.update.my_chat_member;
    Object.assign(logData, {
      member_user_id: memberUpdate?.new_chat_member.user.id,
      old_status: memberUpdate?.old_chat_member.status,
      new_status: memberUpdate?.new_chat_member.status,
      member_update_date: memberUpdate?.date,
    });
  }

  // Log the incoming update
  logger.info(logData, "User action");

  await next();

  const duration = Date.now() - start;
  logger.info(
    {
      chat_id: ctx.chat?.id,
      update_id: ctx.update.update_id,
      update_type: updateType,
      response_time_ms: duration,
    },
    "Response time"
  );
}

export default logging;
