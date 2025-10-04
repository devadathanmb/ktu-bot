import { BotContext } from "../../types/bot.types.js";
import { NextFunction } from "grammy";
import logger from "../../utils/logger.js";

function getMediaType(message: any): string | undefined {
  const mediaTypes = [
    "photo",
    "video",
    "document",
    "audio",
    "voice",
    "sticker",
    "animation",
    "location",
    "contact",
  ];

  return mediaTypes.find(type => message[type]);
}

async function logging(ctx: BotContext, next: NextFunction): Promise<void> {
  const start = Date.now();

  const updateType =
    Object.keys(ctx.update).find(key => key !== "update_id") || "unknown";

  const logData: Record<string, any> = {
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
    chat_title: ctx.chat?.type !== "private" ? ctx.chat?.title : undefined,
  };

  // Message-specific logging
  if (ctx.message) {
    Object.assign(logData, {
      message_id: ctx.message.message_id,
      text: ctx.message.text?.slice(0, 100), // Truncate long messages
      text_length: ctx.message.text?.length,
      command: ctx.message.text?.startsWith("/")
        ? ctx.message.text.split(" ")[0]
        : undefined,
      message_date: ctx.message.date,
      has_entities: ctx.message.entities && ctx.message.entities.length > 0,
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
      query: ctx.inlineQuery.query?.slice(0, 50), // Truncate long queries
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
      edited_text: ctx.editedMessage.text?.slice(0, 100),
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

  // Pre-checkout and successful payment logging
  if (ctx.preCheckoutQuery) {
    Object.assign(logData, {
      pre_checkout_id: ctx.preCheckoutQuery.id,
      currency: ctx.preCheckoutQuery.currency,
      total_amount: ctx.preCheckoutQuery.total_amount,
    });
  }

  if (ctx.message?.successful_payment) {
    Object.assign(logData, {
      payment_currency: ctx.message.successful_payment.currency,
      payment_total_amount: ctx.message.successful_payment.total_amount,
      payment_payload: ctx.message.successful_payment.invoice_payload,
    });
  }

  // Log the incoming update
  logger.info(logData, `User action: ${updateType}`);

  await next();

  const duration = Date.now() - start;
  logger.info(
    {
      chat_id: ctx.chat?.id,
      update_type: updateType,
      response_time_ms: duration,
    },
    `Response time: ${duration}ms`
  );
}

export default logging;
