import { Command, CommandGroup } from "@grammyjs/commands";
import { Composer } from "grammy";
import {
  fetchBranches,
  fetchPrograms,
  fetchSchemes,
  fetchSyllabus,
} from "../../../../api/services/ktu/index.js";
import { BotContext } from "../../../../types/bot.types.js";
import { formatCommand } from "../../../../utils/formatting.js";
import { editMessageIgnoringNotModified } from "../../../../utils/bot.js";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";
import { createSyllabusErrorBoundary } from "../../shared/error-boundary.js";
import { syllabusCommandInfo } from "../command-info.js";
import { CB } from "./constants.js";
import {
  clearSyllabusSession,
  createSyllabusFlow,
  nextPage,
  previousPage,
} from "./flow.js";

const composer = new Composer<BotContext>();
const protectedComposer = composer.errorBoundary(createSyllabusErrorBoundary());
const syllabusFlow = createSyllabusFlow({
  fetchPrograms,
  fetchSchemes,
  fetchBranches,
  fetchSyllabus,
  queueDownload: addAttachmentDeliveryJob,
});
const syllabusLookupCommand = new Command<BotContext>(
  syllabusCommandInfo.name,
  syllabusCommandInfo.description,
  async ctx => {
    await syllabusFlow.start(ctx);
  }
);

protectedComposer.callbackQuery(
  new RegExp(`^${CB.PROGRAM}_select_\\d+$`),
  async ctx => {
    await syllabusFlow.selectProgram(ctx);
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
    await syllabusFlow.selectScheme(ctx);
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
    await syllabusFlow.selectBranch(ctx);
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
    await syllabusFlow.selectEntry(ctx);
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
    await syllabusFlow.restart(ctx);
  }
);
protectedComposer.callbackQuery(
  `${CB.VIEW_ANOTHER}_view_another_false`,
  async ctx => {
    await ctx.answerCallbackQuery();
    await editMessageIgnoringNotModified(() =>
      ctx.editMessageText(
        `Syllabus lookup ended. Use ${formatCommand(syllabusCommandInfo)} to start again.`
      )
    );
    clearSyllabusSession(ctx);
  }
);

const syllabusCommands = new CommandGroup<BotContext>();
syllabusCommands.add(syllabusLookupCommand);
protectedComposer.use(syllabusCommands);

export const syllabusLookup = composer;
export { syllabusCommands };
