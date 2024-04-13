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
<u>Status</u>

<b>• Server Status</b> : ${statusMarkup}
`;
    if (status.log) {
      let logMarkup = `
<u>Last Log</u>

<b>• Status</b> : ${status.log.type.toUpperCase()}
<b>• Reported At</b> : ${status.log.timestamp}
<b>• Since</b> : ${status.log.duration} hrs
<b>• Reason</b> : ${status.log.reason}

Check status <a href="https://stats.uptimerobot.com/Drq58GdQoC">here</a>
`;

      replyMarkup += logMarkup;
    }

    await deleteMessage(ctx, waitingMsgId);
    await ctx.replyWithHTML(replyMarkup);
  } catch (error) {
    await deleteMessage(ctx, waitingMsgId!);
    await ctx.reply("Failed to get server status");
  }
}

export default apiStatus;
