import { Answers, Answer, RequestRecord } from "./forms";

export interface DraftState {
  record: RequestRecord;
  edits: Answers;
  saving: boolean;
  error: string;
  conflicts: string[];
}
/** Serializes partial writes; an older acknowledgement never erases newer typing. */
export class DraftAutosave {
  private record: RequestRecord;
  private edits: Answers = {};
  private originals: Record<string, Answer | undefined> = {};
  private sent: Answers = {};
  private task: Promise<RequestRecord> | null = null;
  private error = "";
  private listeners = new Set<() => void>();
  private snapshot: DraftState;
  constructor(
    record: RequestRecord,
    private write: (
      revision: number,
      answers: Answers,
    ) => Promise<RequestRecord>,
    private reload: () => Promise<RequestRecord>,
    private changed: (record: RequestRecord) => void,
  ) {
    this.record = record;
    this.snapshot = this.view();
  }
  private conflicts() {
    return Object.keys(this.edits).filter(
      (id) =>
        this.record.answers[id] !== this.originals[id] &&
        this.record.answers[id] !== this.edits[id] &&
        !(id in this.sent && this.record.answers[id] === this.sent[id]),
    );
  }
  private view(): DraftState {
    return {
      record: this.record,
      edits: { ...this.edits },
      saving: this.task !== null,
      error: this.error,
      conflicts: this.conflicts(),
    };
  }
  private notify() {
    this.snapshot = this.view();
    this.listeners.forEach((fn) => fn());
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snapshot;
  receive(record: RequestRecord) {
    if (record.revision <= this.record.revision) return;
    this.record = record;
    this.notify();
  }
  change(id: string, value: Answer) {
    if (this.record.status !== "draft") return;
    if (!(id in this.edits)) this.originals[id] = this.record.answers[id];
    this.edits[id] = value;
    if (!(id in this.sent) && value === this.record.answers[id]) {
      delete this.edits[id];
      delete this.originals[id];
    }
    this.error = "";
    this.notify();
  }
  resolve(keep: boolean) {
    for (const id of this.conflicts()) {
      if (keep) this.originals[id] = this.record.answers[id];
      else {
        delete this.edits[id];
        delete this.originals[id];
      }
    }
    this.error = "";
    this.notify();
  }
  flush = (): Promise<RequestRecord> => {
    if (this.task) return this.task;
    this.error = "";
    // Defer work one microtask so saving is visible before the first write.
    this.task = Promise.resolve()
      .then(() => this.drain())
      .catch((e: unknown) => {
        this.error =
          e instanceof Error
            ? e.message
            : "Could not save the draft. Please retry.";
        throw e;
      })
      .finally(() => {
        this.task = null;
        this.sent = {};
        this.notify();
      });
    this.notify();
    return this.task;
  };
  private async drain(): Promise<RequestRecord> {
    let retries = 0;
    while (Object.keys(this.edits).length) {
      if (this.record.status !== "draft")
        throw new Error(
          "This request has been submitted. Your changes were not saved.",
        );
      if (this.conflicts().length)
        throw new Error(
          "This field changed elsewhere. Review the saved value before continuing.",
        );
      const patch = { ...this.edits };
      this.sent = patch;
      try {
        const result = await this.write(this.record.revision, patch);
        if (result.revision >= this.record.revision) this.record = result;
        for (const id of Object.keys(patch)) {
          if (this.edits[id] === patch[id]) {
            delete this.edits[id];
            delete this.originals[id];
          } else if (id in this.edits) this.originals[id] = result.answers[id];
        }
        this.sent = {};
        this.changed(this.record);
        this.notify();
        retries = 0;
      } catch (e) {
        this.sent = {};
        if (
          e instanceof Error &&
          "status" in e &&
          e.status === 409 &&
          retries++ < 3
        ) {
          this.receive(await this.reload());
          this.changed(this.record);
          continue;
        }
        throw e;
      }
    }
    return this.record;
  }
}
