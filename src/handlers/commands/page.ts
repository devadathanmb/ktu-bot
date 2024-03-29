import { CustomContext } from "types/customContext.type";

async function page(ctx: CustomContext) {
  await ctx.reply(
    `This command is only available in the following wizards:

/notifications : To start a notification look up
/calendar : To start an academic calendar look up
/timetable : To start a timetable look up
/oldresults : To start an old results look up

Start any of lookups above to use this command.
`
  );
}

export default page;
