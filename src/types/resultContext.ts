import { Context, Scenes } from "telegraf";
import ResultSession from "./resultSession";

export default interface ResultContext extends Context {
  session: ResultSession;
  scene: Scenes.SceneContextScene<ResultContext, Scenes.WizardSessionData>;
  wizard: Scenes.WizardContextWizard<ResultContext>;
}
