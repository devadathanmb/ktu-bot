import assert from "node:assert/strict";
import test, { after } from "node:test";
import { attachmentDeliveryQueue } from "../../src/workers/attachment-delivery/queue.js";

// Importing the command group pulls in the lookup composers, which import the
// attachment-delivery queue. Closing it keeps the test process from hanging.
after(async () => {
  await attachmentDeliveryQueue.close();
});

test("the core command group registers its commands for help", async () => {
  // Importing group.ts is what registers the metadata /help reads.
  const { coreCommandsGroup } =
    await import("../../src/bot/composers/core/commands/group.js");
  const { getCoreCommands } =
    await import("../../src/bot/composers/core/commands/registry.js");

  assert.deepEqual(
    getCoreCommands().map(command => command.name),
    ["start", "help", "search", "code", "serverstatus"]
  );
  assert.deepEqual(
    getCoreCommands().map(command => command.description),
    coreCommandsGroup.commands.map(command => command.description)
  );
});
