import { Scenes } from "telegraf";

export default interface ResultSession extends Scenes.WizardSession {
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
