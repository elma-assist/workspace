"use client";
import { useRouteState } from "../../hooks/useRouteState";
import { Button, ActionIcon } from "../AsyncAction";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Stack,
  Text,
  Group,
  Badge,
  Select,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { Session } from "../../lib/api";
import {
  FormTemplate,
  RequestRecord,
  formFetch,
  requestBase,
  statusNames,
} from "../../lib/forms";
import { Trash2, Search } from "lucide-react";
import { DeleteDraftDialog } from "./DeleteDraftDialog";
import { RequestDraft } from "./RequestDraft";
import { ErrorNotice, Modal } from "../ui";
export function RequestPanel({
  session,
  onNew,
  onDirty,
  onFlush,
  onLoadingChange,
}: {
  session: Session;
  onNew: (requestId?: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onDirty: (v: boolean) => void;
  onFlush?: (fn: (() => Promise<unknown>) | null) => void;
}) {
  const [routeRequest, setRouteRequest] = useRouteState("active-request");
  const [deleting, setDeleting] = useRouteState("delete-request");
  const deletedIds = useRef(new Set<string>());
  const flushRef = useRef<(() => Promise<unknown>) | null>(null);
  const flushParent = useRef(onFlush);
  flushParent.current = onFlush;
  const registerFlush = useCallback((fn: (() => Promise<unknown>) | null) => {
    flushRef.current = fn;
    flushParent.current?.(fn);
  }, []);
  const [search, setSearch] = useState("");
  async function confirmDelete(id: string) {
    try {
      await flushRef.current?.();
      setDeleting(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const routeRef = useRef(routeRequest);
  routeRef.current = routeRequest;
  const handledRoute = useRef("");
  const [items, setItems] = useState<RequestRecord[]>([]),
    [forms, setForms] = useState<FormTemplate[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [form, setForm] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  useEffect(() => {
    onLoadingChange?.(!initialLoaded || busy);
  }, [initialLoaded, busy, onLoadingChange]);
  const selecting = useRef(false);
  const selectionVersion = useRef(-1),
    notify = useRef(onNew);
  notify.current = onNew;
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const base = requestBase(session);
  const changed = (r: RequestRecord) =>
    setItems((old) => {
      if (deletedIds.current.has(r.id)) return old;
      const existing = old.find((i) => i.id === r.id);
      return [
        existing && existing.revision > r.revision ? existing : r,
        ...old.filter((i) => i.id !== r.id),
      ];
    });
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [r, f, selection] = await Promise.all([
          formFetch<RequestRecord[]>(base + "/requests", session),
          formFetch<FormTemplate[]>(base + "/forms", session),
          formFetch<{ version: number; request: RequestRecord | null }>(
            base + "/active-request",
            session,
          ),
        ]);
        if (!active) return;
        setForms(f);
        setItems((old) =>
          r
            .filter((next) => !deletedIds.current.has(next.id))
            .map((next) => {
              const existing = old.find((x) => x.id === next.id);
              return existing && existing.revision > next.revision
                ? existing
                : next;
            }),
        );
        if (
          selection.version > selectionVersion.current &&
          !dirtyRef.current &&
          !selecting.current
        ) {
          const initial = selectionVersion.current === -1;
          selectionVersion.current = selection.version;
          if (initial && routeRef.current) return;
          if (selection.request && deletedIds.current.has(selection.request.id))
            return;
          setSelected(selection.request?.id ?? null);
          handledRoute.current = selection.request?.id ?? "";
          if (selection.request) {
            changed(selection.request);
            notify.current(selection.request.id);
          } else setRouteRequest(null, true);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setInitialLoaded(true);
      }
    }
    load();
    const timer = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session.id, session.guest_token]);
  async function selectRequest(id: string, navigation = false) {
    selecting.current = true;
    setBusy(true);
    setError("");
    try {
      const state = await formFetch<{
        version: number;
        request: RequestRecord | null;
      }>(base + "/active-request", session, "POST", { request_id: id });
      selectionVersion.current = state.version;
      if (state.request) changed(state.request);
      setSelected(state.request?.id ?? null);
      handledRoute.current = state.request?.id ?? "";
      if (!navigation) setRouteRequest(state.request?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      selecting.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (routeRequest === handledRoute.current) return;
    if (dirtyRef.current) {
      setError("Save your draft before switching requests.");
      setRouteRequest(selected || "list", true);
      return;
    }
    if (!routeRequest || routeRequest === "list") {
      handledRoute.current = routeRequest;
      setSelected(null);
      return;
    }
    handledRoute.current = routeRequest;
    void selectRequest(routeRequest, true);
  }, [routeRequest]);
  const value = items.find((r) => r.id === selected);
  const deleteRecord = items.find((r) => r.id === deleting);
  const visibleItems = items.filter((r) =>
    `${r.code} ${r.snapshot.name}`
      .toLowerCase()
      .includes(search.toLowerCase().replace(/^#/, "")),
  );
  return (
    <section className="request-panel" aria-label="My requests">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>
            {value ? `Request ${value.code}` : "My requests"}
          </Text>
          {value && (
            <Button
              size="xs"
              variant="subtle"
              disabled={dirty}
              onClick={() => {
                setSelected(null);
                setRouteRequest("list");
              }}
            >
              All requests
            </Button>
          )}
        </Group>
        <ErrorNotice error={error} />
        {value && (
          <Text size="xs" c="dimmed">
            Active request — the agent uses this form.
          </Text>
        )}
        {value ? (
          <RequestDraft
            key={value.id}
            value={value}
            session={session}
            changed={changed}
            onFlush={registerFlush}
            onDirty={(v) => {
              setDirty(v);
              onDirty(v);
            }}
          />
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Start a form, continue a saved draft or check your submitted
              requests.
            </Text>
            {!!forms.length && (
              <>
                <Select
                  label="Start a request"
                  placeholder="Choose a form"
                  data={forms.map((f) => ({ value: f.id, label: f.name }))}
                  value={form}
                  onChange={setForm}
                />
                <Button
                  disabled={!form}
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const r = await formFetch<RequestRecord>(
                        base + "/requests",
                        session,
                        "POST",
                        { form_id: form },
                      );
                      changed(r);
                      await selectRequest(r.id);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Open form
                </Button>
              </>
            )}
            {!!items.length && (
              <TextInput
                aria-label="Find request"
                placeholder="Find by number or form"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                leftSection={<Search size={16} />}
              />
            )}
            {visibleItems.map((r) => (
              <Group key={r.id} wrap="nowrap" gap="xs">
                <Button
                  flex={1}
                  variant="light"
                  h="auto"
                  py="sm"
                  styles={{ label: { whiteSpace: "normal", width: "100%" } }}
                  disabled={busy}
                  onClick={() => selectRequest(r.id)}
                >
                  <Group justify="space-between" w="100%">
                    <Text size="sm">
                      <strong>{r.code}</strong> · {r.snapshot.name}
                      <br />
                      {new Date(r.created_at).toLocaleDateString()}
                    </Text>
                    <Badge size="sm">{statusNames[r.status]}</Badge>
                  </Group>
                </Button>
                {r.status === "draft" && (
                  <Tooltip label={`Delete draft ${r.code}`}>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      aria-label={`Delete draft ${r.code}`}
                      onClick={() => confirmDelete(r.id)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            ))}
          </>
        )}
        {value?.status === "draft" && (
          <Button
            color="red"
            variant="subtle"
            leftSection={<Trash2 size={16} />}
            onClick={() => confirmDelete(value.id)}
          >
            Delete draft {value.code}
          </Button>
        )}
        {deleting && !deleteRecord && initialLoaded && (
          <Modal
            title="Draft unavailable"
            compact
            onClose={() => setDeleting(null)}
          >
            <Text>
              This draft was deleted or is no longer available to you.
            </Text>
            <Button onClick={() => setDeleting(null)}>Close</Button>
          </Modal>
        )}
        {deleteRecord && (
          <DeleteDraftDialog
            record={deleteRecord}
            session={session}
            close={() => setDeleting(null)}
            deleted={() => {
              deletedIds.current.add(deleteRecord.id);
              setItems((old) => old.filter((r) => r.id !== deleteRecord.id));
              setDeleting(null);
              if (selected === deleteRecord.id) {
                setSelected(null);
                handledRoute.current = "list";
                setRouteRequest("list", true);
                setDirty(false);
                onDirty(false);
              }
            }}
          />
        )}
        <Text size="xs" c="dimmed">
          {session.guest_token
            ? "Saved for this browser and website. Clearing browser data removes your access."
            : "Your requests are saved to your account."}
        </Text>
      </Stack>
    </section>
  );
}
