import { Markup, Scenes } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchAnnouncements from "../services/fetchAnnouncements";
import fetchAttachment from "../services/fetchAttachment";
import { Attachment } from "../types/types";

const handleCancelCommand = async (ctx: CustomContext) => {
  try {
    await ctx.deleteMessage(ctx.scene.session.announcementMsgId);
  } catch (error) {
  } finally {
    await ctx.reply(
      "Notifications look up cancelled.\n\nPlease use /notifications to start again.",
    );
    return await ctx.scene.leave();
  }
};

const announcementWizard = new Scenes.WizardScene<CustomContext>(
  "announcement-wizard",
  async (ctx: CustomContext) => {
    try {
      ctx.scene.session.pageNumber = 0;
      await showAnnouncements(ctx);
      return ctx.wizard.next();
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply(
        "Please use the buttons to choose a notification.\n\nUse /cancel to cancel notifcations lookup.",
      );
    }
    try {
      const chosenAnnoucement = Number.parseInt(
        (ctx.callbackQuery as any)?.data?.split("_")[1],
      );
      const attachments = ctx.scene.session.announcements
        .find((announcement: any) => announcement.id == chosenAnnoucement)
        .attachments.map((attachment: any) => ({
          name: attachment.name,
          encryptId: attachment.encryptId,
        }));
      await ctx.deleteMessage(ctx.scene.session.announcementMsgId);
      await ctx.reply("Fetching notification.. Please wait..");
      attachments.forEach(async (attachment: Attachment) => {
        const file = await fetchAttachment(attachment.encryptId);
        const fileBuffer = Buffer.from(file, "base64");
        await ctx.replyWithDocument({
          source: fileBuffer,
          filename: attachment.name,
        });
      });
      return await ctx.scene.leave();
    } catch (error) {
      return handleError(ctx, error);
    }
  },
);

async function showAnnouncements(ctx: CustomContext) {
  const announcements = await fetchAnnouncements(
    ctx.scene.session.pageNumber,
    10,
  );
  const announcementButtons = announcements.map(({ id, subject }: any) => ({
    text: subject,
    callback_data: `announcement_${id}`,
  }));
  const nextPageButton = Markup.button.callback("Next Page", "next_page");
  const keyboard = Markup.inlineKeyboard(
    [...announcementButtons, nextPageButton],
    {
      columns: 1,
    },
  );
  const msg = await ctx.sendMessage("Choose a notification:", keyboard);
  ctx.scene.session.announcementMsgId = msg.message_id;
  ctx.scene.session.announcements = announcements;
}

announcementWizard.action("next_page", async (ctx) => {
  ctx.scene.session.pageNumber++;
  await ctx.deleteMessage(ctx.scene.session.announcementMsgId);
  await showAnnouncements(ctx);
  return await ctx.answerCbQuery();
});

async function handleError(ctx: CustomContext, error: any) {
  console.error(error);
  await ctx.reply("Something went wrong. Please try again later.");
  await ctx.scene.leave();
}

announcementWizard.command("cancel", (ctx) => handleCancelCommand(ctx));

export default announcementWizard;
