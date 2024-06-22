import { Scenes } from "telegraf";
import { AcademicCalendar, Announcement, Timetable } from "./types";

export interface WizardSessionData extends Scenes.WizardSessionData {
  courseId: number;
  courseName: string;
  semester: string;
  dob: string;
  regisNo: string;
  index: number;
  waitingMsgId: number | null;

  // Temporary message id to track send messages in wizards
  tempMsgId: number | null;

  // announcement stuff, there is no other way to separate this out for now
  pageNumber: number;
  encryptId: string;
  announcements: Announcement[];

  // academic calendar stuff
  calendars: AcademicCalendar[];

  // timetable stuff
  timetables: Timetable[];
}
