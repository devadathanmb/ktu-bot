import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer } from "grammy";
import { fetchAcademicCalendars } from "../../../../api/services/ktu/index.js";
import { createCalendarErrorBoundary } from "../../shared/error-boundary.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";
import { calendarCommandInfo } from "../command-info.js";
import { createCalendarFlow } from "./flow.js";

const composer = new Composer<BotContext>();
const protectedComposer = composer.errorBoundary(createCalendarErrorBoundary());

const calendarFlow = createCalendarFlow({
  fetchCalendars: fetchAcademicCalendars,
  queueDownload: addAttachmentDeliveryJob,
});

const calendarLookupCommand = new Command<BotContext>(
  calendarCommandInfo.name,
  calendarCommandInfo.description,
  async (ctx: BotContext) => {
    await calendarFlow.start(ctx);
  }
);

protectedComposer.callbackQuery(/^calendar_select_/, async ctx => {
  await calendarFlow.select(ctx);
});

protectedComposer.callbackQuery("calendar_view_another_true", async ctx => {
  await calendarFlow.viewAnother(ctx);
});

protectedComposer.callbackQuery("calendar_view_another_false", async ctx => {
  await calendarFlow.end(ctx);
});

protectedComposer.callbackQuery("calendar_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery("calendar_prev_page", async ctx => {
  await calendarFlow.previousPage(ctx);
});

protectedComposer.callbackQuery("calendar_next_page", async ctx => {
  await calendarFlow.nextPage(ctx);
});

const calendarCommands = new CommandGroup<BotContext>();

calendarCommands.add(calendarLookupCommand);

protectedComposer.use(calendarCommands);

export const calendarLookup = composer;
export { calendarCommands, calendarLookupCommand };
