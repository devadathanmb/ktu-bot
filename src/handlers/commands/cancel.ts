import { CustomContext } from "types/customContext.type";

async function cancel(ctx: CustomContext) {
  await ctx.reply(
    `There are no on going operations to cancel.

Please use:

/result : To start a result look up
/notifications : To start a notification look up
/calendar : To start an academic calendar look up
/timetable : To start a timetable look up
/oldresults : To start an old results look up
`
  );
}

export default cancel;
