import {
  announcementsChangeFilterCommand,
  announcementsSubscribeCommand,
  announcementsUnsubscribeCommand,
} from "../bot/composers/announcement-subscriptions/composer.js";
import { announcementsLookupCommand } from "../bot/composers/lookups/announcements/composer.js";
import { formatCommand } from "../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { fmt, FormattedString } from "@grammyjs/parse-mode";
import { BotContext } from "../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { calendarLookupCommand } from "../bot/composers/lookups/academic-calendar/composer.js";
import { timetableLookupCommand } from "../bot/composers/lookups/exam-timetable/composer.js";
import { BotConfig } from "../configs/bot.js";

const resultDeprecationReason: FormattedString[] = [
  fmt`${emoji("warning")} This feature has been deprecated.`,
  fmt`${emoji("disappointed_face")} KTU no longer provides public API access for results. You can only view your results through the official KTU student portal now.`,
  fmt`For more details, refer to ${FormattedString.link("Why is results not working?", BotConfig.BOT_REWRITE_DOC_URL)}`,
];

const generateMigrationReason = (newCommand: Command<BotContext>) => {
  return [
    fmt`${emoji("delivery_truck")} This command has been migrated.`,
    fmt`${emoji("right_arrow")} Use ${formatCommand(newCommand)} instead`,
  ];
};

const DEPRECATED_COMMAND_TO_REASON_MAP: Record<string, FormattedString[]> = {
  results: resultDeprecationReason,
  result: resultDeprecationReason,
  oldresults: resultDeprecationReason,
  oldresult: resultDeprecationReason,
  subscribe: generateMigrationReason(announcementsSubscribeCommand),
  unsubscribe: generateMigrationReason(announcementsUnsubscribeCommand),
  changefilter: generateMigrationReason(announcementsChangeFilterCommand),
  notifications: generateMigrationReason(announcementsLookupCommand),
  calendar: generateMigrationReason(calendarLookupCommand),
  timetable: generateMigrationReason(timetableLookupCommand),
} as const;

const DEPRECATED_COMMANDS_LIST = Object.keys(DEPRECATED_COMMAND_TO_REASON_MAP);

export { DEPRECATED_COMMAND_TO_REASON_MAP, DEPRECATED_COMMANDS_LIST };
