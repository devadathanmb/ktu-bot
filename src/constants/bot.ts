import {
  announcementsChangeFilterCommand,
  announcementsSubscribeCommand,
  announcementsUnsubscribeCommand,
} from "../bot/composers/announcementSubscriptions/composer.js";
import { formatCommand } from "../utils/getFormattedCommand.js";
import { emoji } from "@grammyjs/emoji";
import { fmt, FormattedString } from "@grammyjs/parse-mode";

const DEPRECATED_COMMAND_TO_DESC_MAP: Record<string, FormattedString[]> = {
  results: [
    fmt`${emoji("warning")} This feature has been deprecated.`,
    fmt`${emoji("disappointed_face")} KTU no longer provides public API access for results. You can only view your results through the official KTU student portal now.`,
    fmt`For more details, refer to ${FormattedString.link("Why is results not working?", "https://github.com/devadathanmb/ktu-bot/blob/grammy-rewrite/docs/rewrite.md#results-not-working-")}`,
  ],
  oldresults: [
    fmt`${emoji("warning")} This feature has been deprecated.`,
    fmt`${emoji("disappointed_face")} KTU no longer provides public API access for results. You can only view your results through the official KTU student portal now.`,
    fmt`For more details, refer to ${FormattedString.link("Why is results not working?", "https://github.com/devadathanmb/ktu-bot/blob/grammy-rewrite/docs/rewrite.md#results-not-working-")}`,
  ],
  subscribe: [
    fmt`${emoji("delivery_truck")} This command has been migrated.`,
    fmt`${emoji("right_arrow")} Use ${formatCommand(announcementsSubscribeCommand)} instead`,
  ],
  unsubscribe: [
    fmt`${emoji("delivery_truck")} This command has been migrated.`,
    fmt`${emoji("right_arrow")} Use ${formatCommand(announcementsUnsubscribeCommand)} instead`,
  ],
  changefilter: [
    fmt`${emoji("delivery_truck")} This command has been migrated.`,
    fmt`${emoji("right_arrow")} Use ${formatCommand(announcementsChangeFilterCommand)} instead`,
  ],
} as const;

const DEPRECATED_COMMANDS_LIST = Object.keys(DEPRECATED_COMMAND_TO_DESC_MAP);

export { DEPRECATED_COMMAND_TO_DESC_MAP, DEPRECATED_COMMANDS_LIST };
