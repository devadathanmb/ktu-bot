// Page information command handler
// This could be useful when the text is too large and wraps around button

import { CustomContext } from "types/customContext.type";

async function handlePageInfoCommand(
  ctx: CustomContext,
  items: any[],
  itemType: string
) {
  let currentPageInfo = `<b>Page - ${ctx.scene.session.pageNumber + 1} Detailed View : </b>\n\n`;

  // Define the title field based on the item type
  let title: string;
  switch (itemType) {
    case "timetable":
      title = "title";
      break;
    case "announcement":
      title = "subject";
      break;
    case "calendar":
      title = "title";
      break;
    default:
      title = "";
  }
  if (!items) {
    return await ctx.replyWithHTML("No items in this page");
  }

  items.forEach((item, index) => {
    currentPageInfo += `${index + 1}) ` + item[title] + "\n\n";
  });

  currentPageInfo += `<b>• <i>Choose an item using the buttons above. Or go to a different page.</i></b>`;
  await ctx.replyWithHTML(currentPageInfo);
}

export default handlePageInfoCommand;
