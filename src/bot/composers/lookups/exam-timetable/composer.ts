import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer } from "grammy";
import { createTimetableErrorBoundary } from "../../shared/error-boundary.js";
import { fetchTimetables } from "../../../../api/services/ktu/index.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";
import { timetableCommandInfo } from "../command-info.js";
import { createTimetableFlow } from "./flow.js";

const composer = new Composer<BotContext>();

const protectedComposer = composer.errorBoundary(
  createTimetableErrorBoundary()
);

const timetableFlow = createTimetableFlow({
  fetchTimetables,
  queueDownload: addAttachmentDeliveryJob,
});

const timetableLookupCommand = new Command<BotContext>(
  timetableCommandInfo.name,
  timetableCommandInfo.description,
  async (ctx: BotContext) => {
    await timetableFlow.start(ctx);
  }
);

protectedComposer.callbackQuery(/^timetable_select_/, async ctx => {
  await timetableFlow.select(ctx);
});

protectedComposer.callbackQuery("timetable_view_another_true", async ctx => {
  await timetableFlow.viewAnother(ctx);
});

protectedComposer.callbackQuery("timetable_view_another_false", async ctx => {
  await timetableFlow.end(ctx);
});

protectedComposer.callbackQuery("timetable_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery("timetable_prev_page", async ctx => {
  await timetableFlow.previousPage(ctx);
});

protectedComposer.callbackQuery("timetable_next_page", async ctx => {
  await timetableFlow.nextPage(ctx);
});

const timetableCommands = new CommandGroup<BotContext>();

timetableCommands.add(timetableLookupCommand);

protectedComposer.use(timetableCommands);

export const timetableLookup = composer;
export { timetableCommands, timetableLookupCommand };
