"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Session } from "../lib/api";
import { formFetch, requestBase, RequestRecord } from "../lib/forms";
import { DraftAutosave } from "../lib/draftAutosave";

export function useDraftAutosave(
  value: RequestRecord,
  session: Session,
  changed: (r: RequestRecord) => void,
) {
  const context = useRef({ session, changed });
  context.current = { session, changed };
  const [draft] = useState(
    () =>
      new DraftAutosave(
        value,
        (revision, answers) =>
          formFetch(
            `${requestBase(context.current.session)}/requests/${value.id}/answers`,
            context.current.session,
            "POST",
            { revision, answers },
          ),
        async () => {
          const rows = await formFetch<RequestRecord[]>(
            requestBase(context.current.session) + "/requests",
            context.current.session,
          );
          const row = rows.find((r) => r.id === value.id);
          if (!row)
            throw new Error(
              "Request unavailable. Your changes have not been saved.",
            );
          return row;
        },
        (r) => context.current.changed(r),
      ),
  );
  const state = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getSnapshot,
  );
  useEffect(() => draft.receive(value), [draft, value]);
  useEffect(() => {
    if (
      !Object.keys(state.edits).length ||
      state.saving ||
      state.error ||
      state.conflicts.length ||
      state.record.status !== "draft"
    )
      return;
    const timer = setTimeout(() => {
      void draft.flush().catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [draft, state]);
  useEffect(() => {
    const leaving = (e: BeforeUnloadEvent) => {
      if (Object.keys(draft.getSnapshot().edits).length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, [draft]);
  return { draft, ...state };
}
