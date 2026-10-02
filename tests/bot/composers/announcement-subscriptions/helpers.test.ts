import assert from "node:assert/strict";
import test from "node:test";
import {
  generateMessageText,
  MESSAGES,
} from "../../../../src/bot/composers/announcement-subscriptions/helpers.js";

test("filter prompts explain which notifications the user is choosing", () => {
  assert.equal(
    generateMessageText([]).text,
    "🔔 Choose your categories\n\nPick the announcement categories you want alerts for. You can choose more than one."
  );
  assert.match(
    generateMessageText([], "change").text,
    /^🔔 Change your categories/
  );
});

test("selected filters are listed on separate lines with a clear save action", () => {
  assert.equal(
    generateMessageText(["BTECH", "MCA"]).text,
    "🔔 Choose your categories\n\n✅ Selected:\n• B.Tech\n• MCA\n\nTap a category again to remove it. Tap “Save categories” when you’re done."
  );
});

test("unsubscribe confirmation states the result and how to subscribe again", () => {
  assert.equal(
    MESSAGES.UNSUBSCRIBE_SUCCESS.text,
    "🔕 Announcement alerts are off.\n\nUse /announcements_subscribe to turn them back on."
  );
});
