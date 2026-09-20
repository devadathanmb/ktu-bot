import assert from "node:assert/strict";
import test from "node:test";
import { closeDB } from "../../src/db/connection.js";

test("closeDB is a no-op when the database was never initialized", async () => {
  await assert.doesNotReject(closeDB());
});
