import assert from "node:assert/strict";
import test from "node:test";
import {
  generateMessageText,
  MESSAGES,
} from "../../../../src/bot/composers/announcement-subscriptions/helpers.js";
import { joinWithNewlines } from "../../../../src/utils/formatting.js";

test("filter prompts explain which notifications the user is choosing", () => {
  assert.equal(
    generateMessageText([]).text,
    "🔔 Choose your announcement filters\n\nChoose the categories you want notifications for. You can select more than one."
  );
  assert.match(
    generateMessageText([], "change").text,
    /^🔔 Change your announcement filters/
  );
});

test("selected filters are listed on separate lines with a clear save action", () => {
  assert.equal(
    generateMessageText(["BTECH", "MCA"]).text,
    "🔔 Choose your announcement filters\n\n✅ Selected:\n• B.Tech\n• MCA\n\nTap a category again to remove it. Tap “Apply Filters” to save."
  );
});

test("unsubscribe confirmation states the result and how to subscribe again", () => {
  assert.equal(
    joinWithNewlines(MESSAGES["UNSUBSCRIBE_SUCCESS"]!, 2).text,
    "✅ Unsubscribed from announcements.\n\nUse /announcements_subscribe to subscribe again."
  );
});
