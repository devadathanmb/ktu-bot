import { Markup, Scenes } from "telegraf";
import { CustomContext } from "types/customContext.type";
import fetchAnnouncements from "services/fetchAnnouncements";
import fetchAttachment from "services/fetchAttachment";
import { Announcement, Attachment } from "types/types";
import deleteMessage from "utils/deleteMessage";
import handleError from "wizards/utils/wizardErrorHandler";
import { callbackQuery } from "telegraf/filters";
import handlePageCommand from "wizards/utils/handlePageCommand";
import { InlineKeyboardButton } from "telegraf/types";
import shortenString from "wizards/utils/shortenString";

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
      ctx.scene.session.pageNumber = 0;
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
      const chosenAnnouncementId = Number.parseInt(
        ctx.callbackQuery.data.split("_")[1]
      );
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

<b>Subject:</b> ${chosenAnnouncement.subject}

<b>Date:</b> ${chosenAnnouncement.date}

<b>Message:</b> ${chosenAnnouncement.message}

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

      await deleteMessage(ctx, ctx.scene.session.waitingMsgId);
      return await ctx.scene.leave();
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
  return await ctx.answerCbQuery();
});

// Previous page button action : Decrement page number and show announcements
announcementWizard.action("prev_page", async (ctx) => {
  if (ctx.scene.session.pageNumber == 0) {
    await ctx.answerCbQuery();
    return await ctx.reply("You are already on the first page.");
  }
  ctx.scene.session.pageNumber--;
  await deleteMessage(ctx, ctx.scene.session.tempMsgId);
  ctx.scene.session.tempMsgId = null;
  await showAnnouncements(ctx);
  return await ctx.answerCbQuery();
});

// Next page button action : Increment page number and show announcements
announcementWizard.action("next_page", async (ctx) => {
  ctx.scene.session.pageNumber++;
  await deleteMessage(ctx, ctx.scene.session.tempMsgId);
  ctx.scene.session.tempMsgId = null;
  await showAnnouncements(ctx);
  return await ctx.answerCbQuery();
});

announcementWizard.command("cancel", async (ctx) => {
  await handleCancelCommand(
    ctx,
    "Notifications look up cancelled.\n\nPlease use /notifications to start again."
  );
});

// Quick page jump
announcementWizard.command(
  "page",
  async (ctx) => await handlePageCommand(ctx, deleteMessage, showAnnouncements)
);

export default announcementWizard;
