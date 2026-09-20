import assert from "node:assert/strict";
import test from "node:test";
import { announcementSubscriptionsCommands } from "../../../../src/bot/composers/announcement-subscriptions/composer.js";
import { announcementSubscriptionCommandInfos } from "../../../../src/bot/composers/announcement-subscriptions/command-info.js";
import { DEPRECATED_COMMAND_TO_REASON_MAP } from "../../../../src/constants/bot.js";
import { formatCommand } from "../../../../src/utils/formatting.js";

test("announcement subscription metadata matches the registered commands", () => {
  const registered = announcementSubscriptionsCommands.commands;

  assert.deepEqual(
    announcementSubscriptionCommandInfos.map(info => info.name),
    registered.map(command => command.stringName)
  );
  assert.deepEqual(
    announcementSubscriptionCommandInfos.map(info => info.description),
    registered.map(command => command.description)
  );
});

test("announcement subscription metadata keeps the help order and names", () => {
  assert.deepEqual(
    announcementSubscriptionCommandInfos.map(info => formatCommand(info)),
    [
      "/announcements_subscribe",
      "/announcements_unsubscribe",
      "/announcements_show_status",
      "/announcements_change_filter",
    ]
  );
});

test("deprecated migration reasons point at static command metadata", () => {
  const migrations: Array<[string, string]> = [
    ["subscribe", "announcements_subscribe"],
    ["unsubscribe", "announcements_unsubscribe"],
    ["changefilter", "announcements_change_filter"],
    ["notifications", "announcements"],
    ["calendar", "calendars"],
    ["timetable", "timetables"],
  ];

  for (const [legacyCommand, migrationTarget] of migrations) {
    const reason = DEPRECATED_COMMAND_TO_REASON_MAP[legacyCommand];
    assert.ok(reason, `missing migration reason for ${legacyCommand}`);

    const reasonText = reason.map(part => part.text).join("\n");
    assert.ok(
      reasonText.includes(`/${migrationTarget}`),
      `${legacyCommand} should migrate to /${migrationTarget}`
    );
  }
});
