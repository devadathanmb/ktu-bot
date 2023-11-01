import shortenCourse from "./shortenCourse";
function formatResultMessage(resultDetails: any[], sgpa: string) {
  let message = "<b>Your Exam Results</b>\n\n";

  resultDetails.forEach(({ courseName, grade, credits }) => {
    const shortenedCourse = shortenCourse(courseName);
    message += `<i>${courseName} (${shortenedCourse})</i>\n`;
    message += `   - <b>Grade:</b> <b>${grade}</b>\n`;
    message += `   - <b>Earned credits:</b> <b>${
      credits ? credits : 0
    }</b>\n\n\n`;
  });

  message += `<b>SGPA:</b> <b>${sgpa}</b>\n\n`;
  return message;
}

export default formatResultMessage;
