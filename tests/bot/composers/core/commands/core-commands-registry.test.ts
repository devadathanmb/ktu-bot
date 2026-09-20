import assert from "node:assert/strict";
import test from "node:test";
import { coreCommandsGroup } from "../../../../../src/bot/composers/core/commands/group.js";
import { coreCommands } from "../../../../../src/bot/composers/core/commands/registry.js";

test("the core command group registers its commands for help", () => {
  assert.deepEqual(
    coreCommands.map(command => command.name),
    ["start", "help", "search", "code", "serverstatus"]
  );
  assert.deepEqual(
    coreCommands.map(command => command.description),
    coreCommandsGroup.commands.map(command => command.description)
  );
});
