import { Scenes } from "telegraf";

export interface WizardSessionData extends Scenes.WizardSessionData {
  courseId: number;
  courseName: string;
  semester: string;
  dob: string;
  regisNo: string;
  examDefId: number;
  schemeId: number;
  waitingMsgId: number;

  // Temporary message id to track send messages in wizards
  tempMsgId: number;

  // announcement stuff, there is no other way to separate this out for now
  pageNumber: number;
  encryptId: string;
  announcements: any[];

  // academic calendar stuff
  calendars: any[];

  // timetable stuff
  timetables: any[];
}
