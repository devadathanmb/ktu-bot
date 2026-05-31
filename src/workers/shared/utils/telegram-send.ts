import type { FormattedString } from "@grammyjs/parse-mode";

export interface ReplyToMessageOptions {
  messageIdToReplyTo?: number | undefined;
}

export function buildReplyParameters(options: ReplyToMessageOptions):
  | {
      reply_parameters: {
        message_id: number;
        allow_sending_without_reply: true;
      };
    }
  | Record<string, never> {
  if (options.messageIdToReplyTo === undefined) return {};

  return {
    reply_parameters: {
      message_id: options.messageIdToReplyTo,
      allow_sending_without_reply: true,
    },
  };
}

export function buildFormattedCaption(formattedText?: FormattedString):
  | {
      caption: string;
      caption_entities: FormattedString["rawEntities"];
    }
  | undefined {
  if (!formattedText) return undefined;

  return {
    caption: formattedText.rawText,
    caption_entities: formattedText.rawEntities,
  };
}
