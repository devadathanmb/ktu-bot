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
  fmt`${emoji("warning")} This feature has been deprecated.`,
  fmt`${emoji("disappointed_face")} KTU no longer provides public API access for results. You can only view your results through the official KTU student portal now.`,
  fmt`For more details, refer to ${FormattedString.link("Why is results not working?", BotConfig.BOT_REWRITE_DOC_URL)}`,
];

const generateMigrationReason = (newCommand: { readonly name: string }) => {
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
  subscribe: generateMigrationReason(announcementsSubscribeCommandInfo),
  unsubscribe: generateMigrationReason(announcementsUnsubscribeCommandInfo),
  changefilter: generateMigrationReason(announcementsChangeFilterCommandInfo),
  notifications: generateMigrationReason(announcementsCommandInfo),
  calendar: generateMigrationReason(calendarCommandInfo),
  timetable: generateMigrationReason(timetableCommandInfo),
} as const;

const DEPRECATED_COMMANDS_LIST = Object.keys(DEPRECATED_COMMAND_TO_REASON_MAP);

export { DEPRECATED_COMMAND_TO_REASON_MAP, DEPRECATED_COMMANDS_LIST };
