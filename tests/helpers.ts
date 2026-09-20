import type { InlineKeyboard } from "grammy";

/**
 * Callback payloads in row order. View keyboards only contain callback
 * buttons, so non-callback buttons surface as `undefined` instead of
 * throwing during the lookup.
 */
export function callbackData(
  keyboard: InlineKeyboard
): Array<string | undefined> {
  return keyboard.inline_keyboard
    .flat()
    .map(button =>
      "callback_data" in button ? button.callback_data : undefined
    );
}
