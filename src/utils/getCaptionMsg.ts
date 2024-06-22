// Utility function to get the caption message from the message object
import { Announcement } from "types/types";

function getCaptionMsg(announcement: Announcement) {
  const captionMsg = `

<b>Subject:</b> ${announcement.subject ? announcement.subject : "N/A"}

<b>Date:</b> ${announcement.date ? announcement.date : "N/A"}

<b>Message:</b> ${announcement.message ? announcement.message : "N/A"}
`;

  return captionMsg;
}

export default getCaptionMsg;
