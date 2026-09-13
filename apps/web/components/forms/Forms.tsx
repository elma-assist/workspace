"use client";
import {
  useRouteState,
  useRouteFlag,
  updateRoute,
} from "../../hooks/useRouteState";
import { Button } from "../AsyncAction";
import { useState, useEffect } from "react";
import { Group, Stack, Title, Text, Paper, Badge } from "@mantine/core";
import { Plus } from "lucide-react";
import { api, Organization } from "../../lib/api";
import { FormTemplate } from "../../lib/forms";
import { ErrorNotice, EmptyState } from "../ui";
import { FormEditor } from "./FormEditor";
export function Forms({ org }: { org: Organization }) {
  const [editorId, setEditorId] = useRouteState("form-editor");
  const [items, setItems] = useState<FormTemplate[]>([]),
    [error, setError] = useState("");
  const editing =
    editorId === "new" ? null : items.find((f) => f.id === editorId);
  const setEditing = (f: FormTemplate | null | undefined) =>
    setEditorId(f === undefined ? null : f === null ? "new" : f.id);
  const load = () =>
    api<FormTemplate[]>(`/organizations/${org.id}/forms`).then(setItems);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [org.id]);
  if (editing !== undefined)
    return (
      <FormEditor
        key={editorId}
        value={editing ?? undefined}
        save={async (data) => {
          await api(
            `/organizations/${org.id}/forms${editing ? "/" + editing.id : ""}`,
            editing ? "PUT" : "POST",
            data,
          );
          await load();
          setEditing(undefined);
        }}
      />
    );
  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1} size="h2">
          Forms
        </Title>
        <Button
          leftSection={<Plus size={16} />}
          onClick={() => setEditing(null)}
        >
          Create form
        </Button>
      </Group>
      <Text c="dimmed">
        Create reusable forms, then assign them in your agent’s settings.
      </Text>
      <ErrorNotice
        error={
          error ||
          (editorId && editing === undefined
            ? "Form unavailable or still loading."
            : "")
        }
      />
      {!items.length && <EmptyState />}
      {items.map((f) => (
        <Paper
          key={f.id}
          component="button"
          type="button"
          withBorder
          p="lg"
          className="object-card"
          onClick={() => setEditing(f)}
          aria-label={`Edit ${f.name}`}
        >
          <Stack gap={4}>
            <Text fw={600}>{f.name}</Text>
            <Text size="sm" c="dimmed">
              {f.description}
            </Text>
            <Badge variant="light" w="fit-content">
              {f.definition.fields.length} fields · Version {f.version}
            </Badge>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
