interface ResultDetails {
  courseName: string;
  grade: string;
  credits: number | null;
}

interface ResultSummary {
  fullName: string;
  branch: string;
  semester: string;
  registrerNo: string;
  institutionName: string;
  resultName: string;
}

interface PublishedResultData {
  resultName: string;
  token: string;
  publishDate: string;
  index: number;
}

interface Course {
  id: number;
  name: string;
}

interface Attachment {
  name: string;
  encryptId: string;
}

interface Announcement {
  id: number;
  subject: string;
  date: string;
  message: string;
  attachments: Attachment[];
}

interface AcademicCalendar {
  id: number;
  title: string;
  attachmentId: number;
  date: string;
  attachmentName: string;
  encryptId: string;
}

interface Timetable {
  id: number;
  attachmentId: number;
  title: string;
  encryptId: string;
  details: string;
  date: string;
  fileName: string;
}

interface Command {
  command: string;
  description: string;
}

interface JobData {
  chatId: number;
  fileLink: string | null;
  captionMsg: string;
  fileName: string | null;
}

export {
  ResultDetails,
  ResultSummary,
  PublishedResultData,
  Course,
  Attachment,
  Announcement,
  AcademicCalendar,
  Timetable,
  Command,
  JobData,
};
