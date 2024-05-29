// Utility function to get the caption message from the message object
import { Announcement } from "types/types";
import { escape } from "html-escaper";

function getCaptionMsg(announcement: Announcement) {
  const captionMsg = `

<b>Subject:</b> ${announcement.subject ? escape(announcement.subject) : "N/A"}

<b>Date:</b> ${announcement.date ? announcement.date : "N/A"}

<b>Message:</b> ${announcement.message ? escape(announcement.message) : "N/A"}
`;

  return captionMsg;
}

export default getCaptionMsg;
