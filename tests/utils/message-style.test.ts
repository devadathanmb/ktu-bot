import assert from "node:assert/strict";
import test from "node:test";
import {
  blocks,
  bullets,
  documentCard,
  downloading,
  field,
  problem,
  tip,
} from "../../src/utils/message-style.js";

test("blocks are separated by a blank line and fields keep label and value together", () => {
  const message = blocks([
    field("📖", "Title", "Exam <notice> & more"),
    tip("Hi"),
  ]);
  assert.equal(message.text, "📖 Title\nExam <notice> & more\n\n💡 Hi");
  assert.deepEqual(
    message.entities.map(entity => entity.type),
    ["bold", "blockquote"]
  );
});

test("document cards skip empty parts and share one layout", () => {
  assert.equal(
    documentCard({ title: "T", message: "M", published: "D" }).text,
    "📖 Title\nT\n\n📝 Message\nM\n\n📅 Published\nD"
  );
  assert.equal(
    documentCard({ title: "", published: "D" }).text,
    "📅 Published\nD"
  );
  assert.equal(documentCard({}).text, "");
});

test("problems say what happened, then what to do", () => {
  assert.equal(problem("Nope.", "Try again.").text, "⚠️ Nope.\n\nTry again.");
  assert.equal(problem("Nope.").text, "⚠️ Nope.");
});

test("download status agrees with singular and plural files", () => {
  assert.match(
    downloading("file").text,
    /I’ll send it here as soon as it’s ready\.$/
  );
  assert.match(
    downloading("files", true).text,
    /I’ll send them here as soon as they’re ready\.$/
  );
});

test("bullets list one item per line", () => {
  assert.equal(bullets(["a", "b"]).text, "• a\n• b");
});
