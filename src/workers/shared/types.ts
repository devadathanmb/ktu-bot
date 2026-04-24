// Global shared types for all workers (only put truly shared types here)

import { FormattedString } from "@grammyjs/parse-mode";

// One of fileId or fileUrl must be present
export type ProcessedAttachment =
  | {
      fileName: string;
      fileId: string;
      fileUrl?: never;
    }
  | {
      fileName: string;
      fileUrl: string;
      fileId?: never;
    };

// Generic broadcast job that any service can use
export interface BroadcastJob {
  formattedText: FormattedString;
  attachments: ProcessedAttachment[];
  chatId: number;
}
