import { Command, CommandGroup } from "@grammyjs/commands";
import { emoji } from "@grammyjs/emoji";
import { Composer } from "grammy";
import { BotContext } from "../../../../types/bot.types.js";
import { formatCommand } from "../../../../utils/formatting.js";
import { createSyllabusErrorBoundary } from "../../shared/error-boundary.js";
import { CB } from "./constants.js";
import {
  clearSyllabusSession,
  nextPage,
  previousPage,
  restart,
  selectBranch,
  selectEntry,
  selectProgram,
  selectScheme,
  start,
} from "./flow.js";

const composer = new Composer<BotContext>();
const protectedComposer = composer.errorBoundary(createSyllabusErrorBoundary());
const syllabusLookupCommand = new Command<BotContext>(
  "syllabus",
  `${emoji("scroll")} Browse and download KTU syllabi by program and branch`,
  async ctx => {
    await start(ctx);
  }
);

protectedComposer.callbackQuery(
  new RegExp(`^${CB.PROGRAM}_select_\\d+$`),
  async ctx => {
    await selectProgram(ctx);
  }
);
protectedComposer.callbackQuery(`${CB.PROGRAM}_page_info`, async ctx => {
  await ctx.answerCallbackQuery();
});
protectedComposer.callbackQuery(`${CB.PROGRAM}_prev_page`, async ctx => {
  await previousPage(ctx, "program");
});
protectedComposer.callbackQuery(`${CB.PROGRAM}_next_page`, async ctx => {
  await nextPage(ctx, "program");
});

protectedComposer.callbackQuery(
  new RegExp(`^${CB.SCHEME}_select_\\d+$`),
  async ctx => {
    await selectScheme(ctx);
  }
);
protectedComposer.callbackQuery(`${CB.SCHEME}_page_info`, async ctx => {
  await ctx.answerCallbackQuery();
});
protectedComposer.callbackQuery(`${CB.SCHEME}_prev_page`, async ctx => {
  await previousPage(ctx, "scheme");
});
protectedComposer.callbackQuery(`${CB.SCHEME}_next_page`, async ctx => {
  await nextPage(ctx, "scheme");
});

protectedComposer.callbackQuery(
  new RegExp(`^${CB.BRANCH}_select_\\d+$`),
  async ctx => {
    await selectBranch(ctx);
  }
);
protectedComposer.callbackQuery(`${CB.BRANCH}_page_info`, async ctx => {
  await ctx.answerCallbackQuery();
});
protectedComposer.callbackQuery(`${CB.BRANCH}_prev_page`, async ctx => {
  await previousPage(ctx, "branch");
});
protectedComposer.callbackQuery(`${CB.BRANCH}_next_page`, async ctx => {
  await nextPage(ctx, "branch");
});

protectedComposer.callbackQuery(
  new RegExp(`^${CB.SYLLABUS}_select_\\d+$`),
  async ctx => {
    await selectEntry(ctx);
  }
);
protectedComposer.callbackQuery(`${CB.SYLLABUS}_page_info`, async ctx => {
  await ctx.answerCallbackQuery();
});
protectedComposer.callbackQuery(`${CB.SYLLABUS}_prev_page`, async ctx => {
  await previousPage(ctx, "entry");
});
protectedComposer.callbackQuery(`${CB.SYLLABUS}_next_page`, async ctx => {
  await nextPage(ctx, "entry");
});

protectedComposer.callbackQuery(
  `${CB.VIEW_ANOTHER}_view_another_true`,
  async ctx => {
    await restart(ctx);
  }
);
protectedComposer.callbackQuery(
  `${CB.VIEW_ANOTHER}_view_another_false`,
  async ctx => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `Syllabus lookup ended. Use ${formatCommand(syllabusLookupCommand)} to start again.`
    );
    clearSyllabusSession(ctx);
  }
);

const syllabusCommands = new CommandGroup<BotContext>();
syllabusCommands.add(syllabusLookupCommand);
protectedComposer.use(syllabusCommands);

export const syllabusLookup = composer;
export { syllabusCommands, syllabusLookupCommand };
