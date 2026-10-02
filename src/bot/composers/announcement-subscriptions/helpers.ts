import { InlineKeyboard } from "grammy";
import { ANNOUNCEMENT_FILTER_MAP } from "../../../constants/courses.js";
import { emoji } from "@grammyjs/emoji";
import { fmt, FormattedString } from "@grammyjs/parse-mode";
import {
  blocks,
  bullets,
  heading,
  ICON,
  lines,
} from "../../../utils/message-style.js";

const MESSAGES = {
  ALREADY_SUBSCRIBED: blocks([
    fmt`${ICON.alertsOn} You’re already getting announcement alerts.`,
    lines([
      fmt`See your categories: /announcements_show_status`,
      fmt`Change them: /announcements_change_filter`,
    ]),
  ]),
  NOT_SUBSCRIBED: blocks([
    fmt`${ICON.alertsOff} You’re not getting announcement alerts yet.`,
    fmt`Use /announcements_subscribe to choose your categories and start.`,
  ]),
  UNSUBSCRIBE_SUCCESS: blocks([
    fmt`${ICON.alertsOff} Announcement alerts are off.`,
    fmt`Use /announcements_subscribe to turn them back on.`,
  ]),
} as const;

function generateFilterKeyboard(selectedFilters: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const entries = Object.entries(ANNOUNCEMENT_FILTER_MAP);

  for (let i = 0; i < entries.length; i += 2) {
    const firstEntry = entries[i];
    if (firstEntry) {
      const [filterName1, filterData1] = firstEntry;
      const isSelected1 = selectedFilters.includes(filterName1);
      const buttonText1 = isSelected1
        ? `${emoji("check_mark_button")} ${filterData1}`
        : filterData1;
      keyboard.text(buttonText1, `announcement_filter_select_${filterName1}`);
    }

    if (i + 1 < entries.length) {
      const secondEntry = entries[i + 1];
      if (secondEntry) {
        const [filterName2, filterData2] = secondEntry;
        const isSelected2 = selectedFilters.includes(filterName2);
        const buttonText2 = isSelected2
          ? `${emoji("check_mark_button")} ${filterData2}`
          : filterData2;
        keyboard.text(buttonText2, `announcement_filter_select_${filterName2}`);
      }
    }

    keyboard.row();
  }

  if (selectedFilters.length > 0) {
    const applyButtonText = `${emoji("bullseye")} Save categories`;
    keyboard.row().text(applyButtonText, "announcement_apply_filters");
  }

  return keyboard;
}

function generateMessageText(
  selectedFilters: string[],
  mode: "add" | "change" = "add"
): FormattedString {
  const title = heading(
    ICON.alertsOn,
    mode === "add" ? "Choose your categories" : "Change your categories"
  );

  if (selectedFilters.length === 0) {
    return blocks([
      title,
      fmt`Pick the announcement categories you want alerts for. You can choose more than one.`,
    ]);
  }

  const selectedNames = selectedFilters.map(
    (filter: string) =>
      ANNOUNCEMENT_FILTER_MAP[filter as keyof typeof ANNOUNCEMENT_FILTER_MAP]
  );
  return blocks([
    title,
    lines([fmt`${ICON.success} Selected:`, bullets(selectedNames)]),
    fmt`Tap a category again to remove it. Tap “Save categories” when you’re done.`,
  ]);
}

export { generateFilterKeyboard, generateMessageText, MESSAGES };
