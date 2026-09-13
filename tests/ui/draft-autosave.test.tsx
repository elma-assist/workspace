import { test } from "node:test";
import assert from "node:assert/strict";
import { DraftAutosave } from "../../apps/web/lib/draftAutosave";
import { FormRequestError, type RequestRecord } from "../../apps/web/lib/forms";

function record(
  answers: RequestRecord["answers"] = {},
  revision = 1,
): RequestRecord {
  return {
    id: "request",
    code: "A01",
    org_id: "org",
    form_id: "form",
    conversation_id: "chat",
    form_version: 1,
    revision,
    answers,
    status: "draft",
    created_at: "2026-09-12T00:00:00Z",
    updated_at: "2026-09-12T00:00:00Z",
    submitted_at: null,
    snapshot: {
      name: "Repair",
      description: "",
      version: 1,
      definition: { schema_version: 1, fields: [] },
    },
  };
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("typing during a save is serialized and a stale acknowledgement cannot erase it", async () => {
  const first = deferred<RequestRecord>();
  const calls: unknown[] = [];
  const draft = new DraftAutosave(
    record(),
    async (revision, answers) => {
      calls.push({ revision, answers });
      if (calls.length === 1) return first.promise;
      return record(answers, 3);
    },
    async () => record(),
    () => {},
  );
  draft.change("name", "Ant");
  const flushing = draft.flush();
  await Promise.resolve();
  draft.change("name", "Anton");
  assert.equal(draft.flush(), flushing);
  assert.equal(draft.getSnapshot().saving, true);
  first.resolve(record({ name: "Ant" }, 2));
  await flushing;
  assert.deepEqual(calls, [
    { revision: 1, answers: { name: "Ant" } },
    { revision: 2, answers: { name: "Anton" } },
  ]);
  assert.equal(draft.getSnapshot().record.answers.name, "Anton");
  assert.deepEqual(draft.getSnapshot().edits, {});
  assert.equal(draft.getSnapshot().saving, false);
});

test("409 retries an unrelated field update using the latest revision", async () => {
  let server = record();
  let calls = 0;
  const draft = new DraftAutosave(
    server,
    async (revision, answers) => {
      if (++calls === 1) {
        server = record({ address: "Berlin" }, 2);
        throw new FormRequestError("Conflict", 409);
      }
      assert.equal(revision, 2);
      server = record({ ...server.answers, ...answers }, 3);
      return server;
    },
    async () => server,
    () => {},
  );
  draft.change("name", "Anton");
  await draft.flush();
  assert.deepEqual(server.answers, { name: "Anton", address: "Berlin" });
});

test("same-field conflict preserves input and requires an explicit resolution", async () => {
  let writes = 0;
  const draft = new DraftAutosave(
    record({ name: "A" }),
    async (revision, answers) => {
      writes++;
      assert.equal(revision, 2);
      return record(answers, 3);
    },
    async () => record(),
    () => {},
  );
  draft.change("name", "Anton");
  draft.receive(record({ name: "Anna" }, 2));
  await assert.rejects(draft.flush(), /changed elsewhere/);
  assert.equal(writes, 0);
  assert.equal(draft.getSnapshot().edits.name, "Anton");
  draft.resolve(true);
  await draft.flush();
  assert.equal(draft.getSnapshot().record.answers.name, "Anton");
});

test("failed writes keep edits for retry and never mark them saved", async () => {
  let online = false;
  const draft = new DraftAutosave(
    record(),
    async (_, answers) => {
      if (!online) throw new Error("Offline");
      return record(answers, 2);
    },
    async () => record(),
    () => {},
  );
  draft.change("name", "Anton");
  await assert.rejects(draft.flush(), /Offline/);
  assert.deepEqual(draft.getSnapshot().record.answers, {});
  assert.equal(draft.getSnapshot().edits.name, "Anton");
  online = true;
  await draft.flush();
  assert.deepEqual(draft.getSnapshot().edits, {});
  assert.equal(draft.getSnapshot().error, "");
});

test("polling an acknowledged save cannot turn subsequent typing into a false conflict", async () => {
  const first = deferred<RequestRecord>();
  let calls = 0;
  const draft = new DraftAutosave(
    record(),
    async (_, answers) => {
      if (++calls === 1) return first.promise;
      return record({ ...answers, address: "Berlin" }, 4);
    },
    async () => record(),
    () => {},
  );
  draft.change("name", "Ant");
  const flushing = draft.flush();
  await Promise.resolve();
  draft.change("name", "Anton");
  draft.receive(record({ name: "Ant", address: "Berlin" }, 3));
  assert.deepEqual(draft.getSnapshot().conflicts, []);
  first.resolve(record({ name: "Ant" }, 2));
  await flushing;
  assert.deepEqual(draft.getSnapshot().record.answers, {
    name: "Anton",
    address: "Berlin",
  });
});

test("submission elsewhere prevents any further draft writes", async () => {
  const draft = new DraftAutosave(
    record(),
    async () => {
      throw new Error("Must not write");
    },
    async () => record(),
    () => {},
  );
  draft.change("name", "Anton");
  draft.receive({ ...record({}, 2), status: "submitted" });
  await assert.rejects(draft.flush(), /submitted/);
  assert.equal(draft.getSnapshot().edits.name, "Anton");
});
