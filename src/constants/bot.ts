import {
  announcementsChangeFilterCommandInfo,
  announcementsSubscribeCommandInfo,
  announcementsUnsubscribeCommandInfo,
} from "../bot/composers/announcement-subscriptions/command-info.js";
import {
  announcementsCommandInfo,
  calendarCommandInfo,
  timetableCommandInfo,
} from "../bot/composers/lookups/command-info.js";
import { formatCommand } from "../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { fmt, FormattedString } from "@grammyjs/parse-mode";
import { BotConfig } from "../configs/bot.js";

const resultDeprecationReason: FormattedString[] = [
  fmt`${emoji("warning")} I can’t show results anymore.`,
  fmt`KTU no longer makes results public. You can check yours by signing in to the official KTU student portal.`,
  fmt`${FormattedString.link("Why can’t I show results?", BotConfig.BOT_REWRITE_DOC_URL)}`,
];

const generateMigrationReason = (newCommand: { readonly name: string }) => {
  return [
    fmt`${emoji("right_arrow")} That command has a new name.`,
    fmt`Use ${formatCommand(newCommand)} instead.`,
  ];
};

const DEPRECATED_COMMAND_TO_REASON_MAP: Record<string, FormattedString[]> = {
  results: resultDeprecationReason,
  result: resultDeprecationReason,
  oldresults: resultDeprecationReason,
  oldresult: resultDeprecationReason,
  subscribe: generateMigrationReason(announcementsSubscribeCommandInfo),
  unsubscribe: generateMigrationReason(announcementsUnsubscribeCommandInfo),
  changefilter: generateMigrationReason(announcementsChangeFilterCommandInfo),
  notifications: generateMigrationReason(announcementsCommandInfo),
  calendar: generateMigrationReason(calendarCommandInfo),
  timetable: generateMigrationReason(timetableCommandInfo),
} as const;

const DEPRECATED_COMMANDS_LIST = Object.keys(DEPRECATED_COMMAND_TO_REASON_MAP);

export { DEPRECATED_COMMAND_TO_REASON_MAP, DEPRECATED_COMMANDS_LIST };
