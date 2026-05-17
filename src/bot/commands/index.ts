import { CommandGroup } from "@grammyjs/commands";
import { BotContext } from "../../types/bot.types.js";

import { coreCommandsGroup } from "../composers/core/composer.js";
import { announcementSubscriptionsCommands } from "../composers/announcement-subscriptions/composer.js";
import { announcementsCommands } from "../composers/lookups/announcements/composer.js";
import { timetableCommands } from "../composers/lookups/exam-timetable/composer.js";
import { calendarCommands } from "../composers/lookups/academic-calendar/composer.js";
import { syllabusCommands } from "../composers/lookups/syllabus/composer.js";

const botCommands = new CommandGroup<BotContext>();

botCommands.add(coreCommandsGroup.commands);
botCommands.add(announcementSubscriptionsCommands.commands);
botCommands.add(announcementsCommands.commands);
botCommands.add(timetableCommands.commands);
botCommands.add(calendarCommands.commands);
botCommands.add(syllabusCommands.commands);

export { botCommands };
