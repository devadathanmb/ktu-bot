import { Scenes } from "telegraf";

export default interface ResultSession extends Scenes.WizardSession {
  courseId: number;
  courseName: string;
  semester: string;
  dob: string;
  ktuid: string;
}
