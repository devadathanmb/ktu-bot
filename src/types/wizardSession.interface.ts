import { Scenes } from "telegraf";

export interface WizardSessionData extends Scenes.WizardSessionData {
  courseId: number;
  courseName: string;
  semester: string;
  dob: string;
  regisNo: string;
  examDefId: number;
  schemeId: number;
  resultMsgId: number;
  courseMsgId: number;
  waitingMsgId: number;

  // announcement stuff, there is no other way to separate this out for now
  pageNumber: number;
  encryptId: string;
  announcementMsgId: number;
  announcements: any[];

  // academic calendar stuff
  calendarMsgId: number;
  calendars: any[];

  // timetable stuff
  timetableMsgId: number;
  timetables: any[];
}
