"use client";
import { useDraftAutosave } from "../../hooks/useDraftAutosave";
import { Button } from "../AsyncAction";
import { useEffect, useRef, useState } from "react";
import { Stack, Text, Group, Badge, Alert } from "@mantine/core";
import { Session } from "../../lib/api";
import {
  RequestRecord,
  formFetch,
  requestBase,
  statusNames,
} from "../../lib/forms";
import { Fields } from "./Fields";
import { Photos } from "./Photos";
import { ErrorNotice } from "../ui";
export function RequestDraft({
  value: incoming,
  session,
  changed,
  onDirty,
  onFlush,
}: {
  value: RequestRecord;
  session: Session;
  changed: (r: RequestRecord) => void;
  onDirty: (v: boolean) => void;
  onFlush?: (fn: (() => Promise<unknown>) | null) => void;
}) {
  const auto = useDraftAutosave(incoming, session, changed);
  const value = auto.record,
    dirty = auto.edits;
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const isDirty = Object.keys(dirty).length > 0;
  const readOnly = value.status !== "draft";
  const conflict = auto.conflicts.length > 0;
  const notifyDirty = useRef(onDirty),
    notifyFlush = useRef(onFlush);
  notifyDirty.current = onDirty;
  notifyFlush.current = onFlush;
  useEffect(() => {
    notifyDirty.current(isDirty || auto.saving);
    return () => notifyDirty.current(false);
  }, [isDirty, auto.saving]);
  useEffect(() => {
    notifyFlush.current?.(auto.draft.flush);
    return () => notifyFlush.current?.(null);
  }, [auto.draft]);
  const base = `${requestBase(session)}/requests/${value.id}`;
  const save = auto.draft.flush;
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>{value.snapshot.name}</Text>
        <Badge>{statusNames[value.status]}</Badge>
      </Group>
      <Text size="xs" c="dimmed">
        {readOnly
          ? "Submitted answers are read-only."
          : auto.saving
            ? "Saving draft…"
            : auto.error || conflict
              ? "Changes not saved. Review the details below."
              : isDirty
                ? "Changes will save automatically…"
                : "Draft saved. You can fill it yourself or ask the agent."}
      </Text>
      {conflict && (
        <Alert color="yellow" title="The form changed while you were editing">
          Your unsaved values are preserved below. Latest saved values:{" "}
          {auto.conflicts
            .map(
              (k) =>
                `${value.snapshot.definition.fields.find((f) => f.id === k)?.label ?? k}: ${String(value.answers[k] ?? "empty")}`,
            )
            .join("; ")}
          <Group mt="xs">
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                auto.draft.resolve(true);
              }}
            >
              Keep my changes
            </Button>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                auto.draft.resolve(false);
              }}
            >
              Use saved values
            </Button>
          </Group>
        </Alert>
      )}
      <Fields
        fields={value.snapshot.definition.fields}
        answers={{ ...value.answers, ...dirty }}
        saved={value.answers}
        saving={auto.saving}
        saveError={!!auto.error || conflict}
        blur={() => {
          void save().catch(() => {});
        }}
        hasImages={(id) => (value.files ?? []).some((f) => f.field_id === id)}
        readOnly={readOnly || busy}
        change={(id, v) => {
          auto.draft.change(id, v);
        }}
        images={(f) => (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {f.label}
              {f.required ? " *" : ""}
            </Text>
            <Photos
              files={(value.files ?? []).filter((a) => a.field_id === f.id)}
              base={base + "/files"}
              session={session}
              busy={uploading}
              upload={
                readOnly
                  ? undefined
                  : async (file) => {
                      setUploading(true);
                      await act(async () => {
                        if (file.size > 8 * 1024 * 1024)
                          throw new Error(
                            "Each photo must be smaller than 8 MB",
                          );
                        await save();
                        const data = new FormData();
                        data.append("field_id", f.id);
                        data.append("file", file);
                        const r = await formFetch<RequestRecord>(
                          base + "/files",
                          session,
                          "POST",
                          data,
                        );
                        changed(r);
                        auto.draft.receive(r);
                      });
                      setUploading(false);
                    }
              }
              remove={
                readOnly
                  ? undefined
                  : (id) =>
                      act(async () => {
                        await save();
                        const r = await formFetch<RequestRecord>(
                          base + `/files/${id}/remove`,
                          session,
                          "POST",
                          {},
                        );
                        changed(r);
                        auto.draft.receive(r);
                      })
              }
            />
          </Stack>
        )}
      />
      <ErrorNotice error={error || auto.error} />
      {!readOnly ? (
        <Button
          disabled={isDirty || auto.saving || busy || conflict}
          onClick={() =>
            act(async () => {
              const r = await formFetch<RequestRecord>(
                base + "/submit",
                session,
                "POST",
                { revision: value.revision, confirmed: true },
              );
              changed(r);
            })
          }
        >
          Submit request
        </Button>
      ) : (
        <Alert color="green">
          Request received. Your team will review it. You can check its status
          in My requests.
        </Alert>
      )}
    </Stack>
  );
}
