import { CustomContext } from "@/types/customContext.type";
import getApiStatus from "@/services/getApiStatus";
import deleteMessage from "@/utils/deleteMessage";

async function apiStatus(ctx: CustomContext) {
  let waitingMsgId: number;
  try {
    const msg = await ctx.reply("Checking server status.. Please wait...");
    waitingMsgId = msg.message_id;
    const status = await getApiStatus();
    let statusMarkup = "";
    if (status.status === "up") {
      statusMarkup = "UP ✅";
    } else if (status.status === "down") {
      statusMarkup = "DOWN ❌";
    } else {
      statusMarkup = `${status.status.toUpperCase()} ❓`;
    }

    let replyMarkup = `
<u>KTU API Server Status</u>

<b>• Server Status</b> : ${statusMarkup}
<b>• Avg response time</b> : ${status.responseTime} ms
`;
    if (status.log) {
      let logMarkup = `
<u>Last Log</u>

<b>• Status</b> : ${status.log.type.toUpperCase()}
<b>• Reported At</b> : ${status.log.timestamp}
<b>• Duration</b> : ${status.log.duration} hrs
<b>• Reason</b> : ${status.log.reason}
`;

      replyMarkup += logMarkup;
    }

    await deleteMessage(ctx, waitingMsgId);
    await ctx.replyWithHTML(replyMarkup, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "ℹ️  Check detailed status",
              url: "https://stats.uptimerobot.com/Drq58GdQoC",
            },
          ],
        ],
      },
    });
  } catch (error) {
    await deleteMessage(ctx, waitingMsgId!);
    await ctx.reply("Failed to get server status");
  }
}

export default apiStatus;
