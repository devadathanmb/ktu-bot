import { InlineKeyboard } from "grammy";
import { ANNOUNCEMENT_FILTER_MAP } from "../../../constants/courses.js";
import { emoji } from "@grammyjs/emoji";
import { fmt, FormattedString } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";

const MESSAGES: Record<string, Array<FormattedString>> = {
  ALREADY_SUBSCRIBED: [
    fmt`${emoji("bell")} You’re already subscribed to announcements.`,
    fmt`Use /announcements_show_status to see your filters.`,
  ],
  NOT_SUBSCRIBED_WITH_EMOJI: [
    fmt`${emoji("cross_mark")} You are not subscribed to announcements.`,
    fmt`Use /announcements_subscribe to choose your filters and subscribe.`,
  ],
  NOT_SUBSCRIBED_CHANGE_FILTER: [
    fmt`${emoji("cross_mark")} You are not subscribed to announcements.`,
    fmt`${emoji("light_bulb")} Use /announcements_subscribe to subscribe first.`,
  ],
  UNSUBSCRIBE_SUCCESS: [
    fmt`${emoji("check_mark_button")} Unsubscribed from announcements.`,
    fmt`Use /announcements_subscribe to subscribe again.`,
  ],
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
    const applyButtonText = `${emoji("bullseye")} Apply Filters`;
    keyboard.row().text(applyButtonText, "announcement_apply_filters");
  }

  return keyboard;
}

function generateMessageText(
  selectedFilters: string[],
  mode: "add" | "change" = "add"
): FormattedString {
  if (selectedFilters.length === 0) {
    const action = mode === "add" ? "Choose" : "Change";
    return joinWithNewlines(
      [
        fmt`${emoji("bell")} ${action} your announcement filters`,
        fmt`Choose the categories you want notifications for. You can select more than one.`,
      ],
      2
    );
  }

  const selectedNames = selectedFilters.map(
    (filter: string) =>
      ANNOUNCEMENT_FILTER_MAP[filter as keyof typeof ANNOUNCEMENT_FILTER_MAP]
  );
  const action = mode === "add" ? "Choose" : "Change";
  return joinWithNewlines(
    [
      fmt`${emoji("bell")} ${action} your announcement filters`,
      joinWithNewlines([
        fmt`${emoji("check_mark_button")} Selected:`,
        ...selectedNames.map(name => fmt`• ${name}`),
      ]),
      fmt`Tap a category again to remove it. Tap “Apply Filters” to save.`,
    ],
    2
  );
}

export { generateFilterKeyboard, generateMessageText, MESSAGES };
