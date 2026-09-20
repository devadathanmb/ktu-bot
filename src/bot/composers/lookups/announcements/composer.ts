import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer } from "grammy";
import { createAnnouncementsErrorBoundary } from "../../shared/error-boundary.js";
import { fetchAnnouncements } from "../../../../api/services/ktu/index.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";
import { announcementsCommandInfo } from "../command-info.js";
import { createAnnouncementsFlow } from "./flow.js";

const composer = new Composer<BotContext>();

const protectedComposer = composer.errorBoundary(
  createAnnouncementsErrorBoundary()
);

const announcementsFlow = createAnnouncementsFlow({
  fetchAnnouncements,
  queueDownload: addAttachmentDeliveryJob,
});

const announcementsLookupCommand = new Command<BotContext>(
  announcementsCommandInfo.name,
  announcementsCommandInfo.description,
  async ctx => {
    await announcementsFlow.start(ctx);
  }
);

protectedComposer.callbackQuery(/^announcement_select_/, async ctx => {
  await announcementsFlow.select(ctx);
});

protectedComposer.callbackQuery("announcement_view_another_true", async ctx => {
  await announcementsFlow.viewAnother(ctx);
});

protectedComposer.callbackQuery(
  "announcement_view_another_false",
  async ctx => {
    await announcementsFlow.end(ctx);
  }
);

protectedComposer.callbackQuery("announcement_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery("announcement_prev_page", async ctx => {
  await announcementsFlow.previousPage(ctx);
});

protectedComposer.callbackQuery("announcement_next_page", async ctx => {
  await announcementsFlow.nextPage(ctx);
});

const announcementsCommands = new CommandGroup<BotContext>();

announcementsCommands.add(announcementsLookupCommand);

protectedComposer.use(announcementsCommands);

export const announcementsLookup = composer;
export { announcementsCommands };
