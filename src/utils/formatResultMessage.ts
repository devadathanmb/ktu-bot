import { ResultDetails } from "@/types/types";
import shortenCourse from "./shortenCourse";
function formatResultMessage(resultDetails: ResultDetails[], sgpa: string) {
  const SPLIT_LIMIT = 8;
  let messages: string[] = [];
  let message = "<u><b>Your Exam Results</b></u>\n\n";

  // If result payload contains lots of courses, then we need split the message into multiple messages

  for (let i = 0; i < resultDetails.length; i += 1) {
    if (i % SPLIT_LIMIT === 0 && i !== 0) {
      messages.push(message);
      message = "";
    }
    const shortenedCourse = shortenCourse(resultDetails[i].courseName);
    message += `<u><i>${resultDetails[i].courseName} (${shortenedCourse})</i></u>\n`;
    message += `   - <b>Grade:</b> <b>${resultDetails[i].grade}</b>\n`;
    message += `   - <b>Earned credits:</b> <b>${
      resultDetails[i].credits ? resultDetails[i].credits : 0
    }</b>\n\n\n`;
  }

  // If total pushed messages are less than the length of resultDetails, then push the remaining message
  // then push the final remaining message
  if (messages.length * SPLIT_LIMIT < resultDetails.length) {
    messages.push(message);
  }

  messages[messages.length - 1] += `<b>SGPA:</b> <b>${sgpa}</b>\n\n`;
  return messages;
}

export default formatResultMessage;
