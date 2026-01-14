import { CommandGroup } from "@grammyjs/commands";
import { BotContext } from "../../types/bot.types.js";

import { coreCommandsGroup } from "../composers/core/composer.js";
import { announcementSubscriptionsCommands } from "../composers/announcement-subscriptions/composer.js";
import { announcementsCommands } from "../composers/lookups/announcements/composer.js";
import { timetableCommands } from "../composers/lookups/exam-timetable/composer.js";
import { calendarCommands } from "../composers/lookups/academic-calendar/composer.js";

// Create the main bot commands group that combines all command groups
const botCommands = new CommandGroup<BotContext>();

// Hook individual command groups into the main command group
botCommands.add(coreCommandsGroup.commands);
botCommands.add(announcementSubscriptionsCommands.commands);
botCommands.add(announcementsCommands.commands);
botCommands.add(timetableCommands.commands);
botCommands.add(calendarCommands.commands);

// Export the combined commands group
export { botCommands };
