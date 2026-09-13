"use client";
import {
  useRouteState,
  useRouteFlag,
  updateRoute,
} from "../../hooks/useRouteState";
import { Button } from "../AsyncAction";
import { useEffect, useState } from "react";
import {
  Stack,
  Group,
  Title,
  Text,
  Paper,
  Badge,
  Select,
  TextInput,
  Alert,
} from "@mantine/core";
import { api, Organization } from "../../lib/api";
import { RequestRecord, statusNames } from "../../lib/forms";
import { EditorPage, ErrorNotice, EmptyState } from "../ui";
import { Fields } from "./Fields";
import { Photos } from "./Photos";
import { ConfirmDelete } from "../ConfirmDelete";
import { Trash2 } from "lucide-react";
export function Requests({ org }: { org: Organization }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useRouteState("request");
  const [deleting, setDeleting] = useRouteFlag("delete-admin-request");
  const [items, setItems] = useState<RequestRecord[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = items.find((r) => r.id === selected);
  const load = () =>
    api<RequestRecord[]>(`/organizations/${org.id}/requests`).then(setItems);
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const timer = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [org.id]);
  if (current)
    return (
      <>
        <EditorPage title={`${current.code} · ${current.snapshot.name}`}>
          <Stack>
            {org.role !== "employee" && (
              <Group justify="flex-end">
                <Button
                  color="red"
                  variant="light"
                  leftSection={<Trash2 size={16} />}
                  onClick={() => setDeleting(true)}
                >
                  Delete request
                </Button>
              </Group>
            )}
            <Text size="sm" c="dimmed">
              Form version {current.form_version} · Submitted{" "}
              {current.submitted_at
                ? new Date(current.submitted_at).toLocaleString()
                : ""}
            </Text>
            <Select
              label="Request status"
              disabled={busy}
              value={current.status}
              data={Object.entries(statusNames)
                .filter(([v]) => v !== "draft")
                .map(([value, label]) => ({ value, label }))}
              onChange={async (status) => {
                if (!status) return;
                setBusy(true);
                try {
                  await api(
                    `/organizations/${org.id}/requests/${current.id}/status`,
                    "POST",
                    { status, revision: current.revision },
                  );
                  await load();
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                  await load();
                } finally {
                  setBusy(false);
                }
              }}
            />
            <ErrorNotice error={error} />
            <Fields
              fields={current.snapshot.definition.fields}
              answers={current.answers}
              change={() => {}}
              readOnly
              images={(f) => (
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    {f.label}
                  </Text>
                  <Photos
                    files={(current.files ?? []).filter(
                      (a) => a.field_id === f.id,
                    )}
                    base={`/api/organizations/${org.id}/requests/${current.id}/files`}
                  />
                </Stack>
              )}
            />
            <Alert variant="light">
              Conversation is retained in the organization’s Conversations
              section.
            </Alert>
            <Text fw={600}>Status history</Text>
            {(current.events ?? []).map((e, i) => (
              <Text key={i} size="sm">
                {statusNames[e.status]} · {e.actor} ·{" "}
                {new Date(e.created_at).toLocaleString()}
              </Text>
            ))}
          </Stack>
        </EditorPage>
        {deleting && org.role !== "employee" && (
          <ConfirmDelete
            title={`Delete request ${current.code}`}
            description="This permanently deletes the request, its answers, status history and photos. This cannot be undone."
            confirmLabel="Delete request"
            close={() => setDeleting(false)}
            confirm={async () => {
              await api(
                `/organizations/${org.id}/requests/${current.id}`,
                "DELETE",
              );
              setItems((all) => all.filter((item) => item.id !== current.id));
              updateRoute({ request: null, "delete-admin-request": null });
            }}
          />
        )}
      </>
    );
  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1} size="h2">
          Requests
        </Title>
        <Button
          variant="light"
          onClick={() => load().catch((e) => setError(e.message))}
        >
          Refresh
        </Button>
      </Group>
      <Text c="dimmed">
        Submitted requests from your agents. Changes are visible to the
        customer.
      </Text>
      <ErrorNotice
        error={
          error ||
          (selected && !current ? "Request unavailable or still loading." : "")
        }
      />
      {!items.length && <EmptyState />}
      {!!items.length && (
        <TextInput
          aria-label="Find request"
          placeholder="Find by number or form"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      )}
      {items
        .filter((r) =>
          `${r.code} ${r.snapshot.name}`
            .toLowerCase()
            .includes(search.toLowerCase().replace(/^#/, "")),
        )
        .map((r) => (
          <Paper
            withBorder
            p="lg"
            key={r.id}
            component="button"
            type="button"
            className="object-card"
            onClick={() => setSelected(r.id)}
            aria-label={`Open request ${r.code}`}
          >
            <Stack gap={4}>
              <Text fw={600}>
                {r.code} · {r.snapshot.name}
              </Text>
              <Text size="sm" c="dimmed">
                {new Date(r.created_at).toLocaleString()} ·{" "}
                {String(r.answers.name ?? r.answers.email ?? "Customer")}
              </Text>
              <Badge w="fit-content">{statusNames[r.status]}</Badge>
            </Stack>
          </Paper>
        ))}
    </Stack>
  );
}
