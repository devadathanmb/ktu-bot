import { Composer, Markup, Scenes } from "telegraf";
import { CustomContext } from "types/customContext.type";
import fetchAnnouncements from "services/fetchAnnouncements";
import fetchAttachment from "services/fetchAttachment";
import { Announcement, Attachment } from "types/types";
import deleteMessage from "utils/deleteMessage";
import handleError from "wizards/utils/wizardErrorHandler";
import handleMyChatMember from "./utils/handleMyChatMember";
import { callbackQuery } from "telegraf/filters";
import handlePageCommand from "wizards/utils/handlePageCommand";
import { InlineKeyboardButton } from "telegraf/types";
import shortenString from "wizards/utils/shortenString";
import { escape } from "html-escaper";

/*
  - Announcement lookup is also desinged as a WizardScene.
  - This wizard only has two steps. The first step fetches the announcements and displays them to the user.
    And the second step fetches the selected announcement and sends it to the user.

  - Previous and next buttons are also available to navigate through the announcements.

  - Just like in /result wizard, only /cancel command is defined to work inside the wizard. No other commands will work inside the wizard.
*/

const handleCancelCommand = async (ctx: CustomContext, replyMsg: string) => {
  await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
  await deleteMessage(ctx, ctx.scene.session.tempMsgId);
  await ctx.reply(replyMsg);
  return await ctx.scene.leave();
};

const announcementWizard = new Scenes.WizardScene<CustomContext>(
  "announcement-wizard",

  // Wizard Step 0
  async (ctx: CustomContext) => {
    try {
      if (ctx.scene.session.pageNumber === undefined) {
        ctx.scene.session.pageNumber = 0;
      }
      await showAnnouncements(ctx);
      return ctx.wizard.next();
    } catch (error: any) {
      return await handleError(ctx, error);
    }
  },

  // Wizard Step 1
  async (ctx) => {
    if (ctx.message) {
      return await ctx.reply(
        "Please use the buttons to choose a notification.\n\nUse /cancel to cancel notifcations lookup."
      );
    }
    try {
      if (!ctx.has(callbackQuery("data"))) {
        return await ctx.scene.leave();
      }
      await ctx.answerCbQuery();
      if (!ctx.callbackQuery.data.startsWith("announcement")) {
        return await ctx.reply("Please choose a valid option");
      }
      const chosenAnnouncementId = Number.parseInt(
        ctx.callbackQuery.data.split("_")[1]
      );

      if (!chosenAnnouncementId) {
        return await ctx.reply("Please choose a valid option");
      }

      const chosenAnnouncement: Announcement =
        ctx.scene.session.announcements.find(
          (announcement: Announcement) =>
            announcement.id == chosenAnnouncementId
        )!;

      const attachments: Attachment[] = chosenAnnouncement.attachments.map(
        (attachment: Attachment) => ({
          name: attachment.name,
          encryptId: attachment.encryptId,
        })
      );

      await deleteMessage(ctx, ctx.scene.session.tempMsgId);
      ctx.scene.session.tempMsgId = null;
      const waitingMsg = await ctx.reply(
        "Fetching notification.. Please wait.."
      );
      ctx.scene.session.waitingMsgId = waitingMsg.message_id;

      if (!chosenAnnouncement.subject) {
        chosenAnnouncement.subject = "N/A";
      }

      if (!chosenAnnouncement.date) {
        chosenAnnouncement.date = "N/A";
      }

      if (!chosenAnnouncement.message) {
        chosenAnnouncement.message = "N/A";
      }

      const captionMsg = `

<b>Subject:</b> ${escape(chosenAnnouncement.subject)}

<b>Date:</b> ${chosenAnnouncement.date}

<b>Message:</b> ${escape(chosenAnnouncement.message)}

`;
      if (attachments.length == 0) {
        await ctx.replyWithHTML(captionMsg);
        await ctx.reply("No attachments found.");
      }

      for (const attachment of attachments) {
        const file = await fetchAttachment(attachment.encryptId);
        const fileBuffer = Buffer.from(file, "base64");

        await ctx.replyWithDocument(
          {
            source: fileBuffer,
            filename: attachment.name,
          },
          { caption: captionMsg, parse_mode: "HTML" }
        );
      }

      await ctx.replyWithHTML("View another notification?", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Yes ✅",
                callback_data: "check_another_announcement_true",
              },
              {
                text: "No ❌",
                callback_data: "check_another_announcement_false",
              },
            ],
          ],
        },
      });

      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
    } catch (error) {
      return await handleError(ctx, error);
    }
  }
);

// Function to show announcements
async function showAnnouncements(ctx: CustomContext) {
  try {
    const waitingMsg = await ctx.reply(
      "Fetching notifications.. Please wait.."
    );
    ctx.scene.session.waitingMsgId = waitingMsg.message_id;
    const announcements = await fetchAnnouncements(
      ctx.scene.session.pageNumber,
      10
    );
    let announcementMsg = "<b>Announcements</b>:\n\n";
    let announcementButtons: InlineKeyboardButton.CallbackButton[] = [];

    announcements.forEach(({ id, subject }, index) => {
      announcementMsg += `${index + 1}) ${shortenString(subject)}\n\n`;
      announcementButtons.push(
        Markup.button.callback(`${index + 1}`, `announcement_${id}`)
      );
    });

    announcementMsg += `<b>• <i>Choose a notification using the buttons below</i></b>\n\n`;
    announcementMsg += `<b>• <i>Use <code>/page pageno</code> to jump to a specific page</i></b>`;

    const nextPageButton = Markup.button.callback("Next ⏭️", "next_page");
    const prevPageButton = Markup.button.callback("Prev ⏮️", "prev_page");
    const pageInfoButton = Markup.button.callback(
      `Page : ${ctx.scene.session.pageNumber + 1}`,
      "page"
    );
    const keyboard = Markup.inlineKeyboard(
      [...announcementButtons, prevPageButton, pageInfoButton, nextPageButton],
      {
        wrap(btn, index, _currentRow) {
          if (!isNaN(Number(btn.text))) {
            if (index % 5 === 0) {
              return true;
            }
            return false;
          } else if (btn === prevPageButton) {
            return true;
          }
          return false;
        },
      }
    );
    await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
    ctx.scene.session.waitingMsgId = null;
    const msg = await ctx.sendMessage(announcementMsg, {
      parse_mode: "HTML",
      ...keyboard,
    });
    ctx.scene.session.tempMsgId = msg.message_id;
    ctx.scene.session.announcements = announcements;
  } catch (error) {
    await handleError(ctx, error);
  }
}

// Page button action : Answer callback query and do nothing
announcementWizard.action("page", async (ctx) => {
  try {
    return await ctx.answerCbQuery();
  } catch (error) {
    await handleError(ctx, error);
  }
});

// Previous page button action : Decrement page number and show announcements
announcementWizard.action("prev_page", async (ctx) => {
  try {
    if (ctx.scene.session.pageNumber === 0) {
      await ctx.answerCbQuery();
      return await ctx.reply("You are already on the first page.");
    }
    ctx.scene.session.pageNumber--;
    await deleteMessage(ctx, ctx.scene.session.tempMsgId);
    ctx.scene.session.tempMsgId = null;
    await showAnnouncements(ctx);
    return await ctx.answerCbQuery();
  } catch (error) {
    await handleError(ctx, error);
  }
});

// Next page button action : Increment page number and show announcements
announcementWizard.action("next_page", async (ctx) => {
  try {
    ctx.scene.session.pageNumber++;
    await deleteMessage(ctx, ctx.scene.session.tempMsgId);
    ctx.scene.session.tempMsgId = null;
    await showAnnouncements(ctx);
    return await ctx.answerCbQuery();
  } catch (error) {
    await handleError(ctx, error);
  }
});

announcementWizard.command("cancel", async (ctx) => {
  try {
    await handleCancelCommand(
      ctx,
      "Notifications look up cancelled.\n\nPlease use /notifications to start again."
    );
  } catch (error) {
    await handleError(ctx, error);
  }
});

// Quick page jump
announcementWizard.command("page", async (ctx) => {
  try {
    await handlePageCommand(ctx, deleteMessage, showAnnouncements);
  } catch (error) {
    await handleError(ctx, error);
  }
});

announcementWizard.action(
  "check_another_announcement_true",
  async (ctx, _next) => {
    try {
      await ctx.answerCbQuery();
      ctx.scene.session.tempMsgId = null;
      await deleteMessage(ctx, ctx.msgId!);
      ctx.wizard.selectStep(0);
      return Composer.unwrap(ctx.wizard.step!)(ctx, _next);
    } catch (error) {
      await handleError(ctx, error);
    }
  }
);

announcementWizard.action("check_another_announcement_false", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(
      "Notifications lookup ended. Use /notifications to start again."
    );
    await deleteMessage(ctx, ctx.msgId!);
    await ctx.scene.leave();
  } catch (error) {
    await handleError(ctx, error);
  }
});

announcementWizard.on("my_chat_member", handleMyChatMember);

export default announcementWizard;
