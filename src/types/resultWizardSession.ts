import { Scenes } from "telegraf";

export interface ResultWizardSession extends Scenes.WizardSessionData {
  courseId: number;
  courseName: string;
  semester: string;
  dob: string;
  regisNo: string;
  examDefId: number;
  schemeId: number;
  resultMsgId: number;
  courseMsgId: number;
}
