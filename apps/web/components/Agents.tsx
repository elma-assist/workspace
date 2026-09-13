"use client";
import {
  useRouteState,
  useRouteFlag,
  updateRoute,
} from "../hooks/useRouteState";
import { Button } from "./AsyncAction";
import {
  Stack,
  TextInput,
  Textarea,
  NativeSelect,
  Checkbox,
  Card,
  Group,
  SimpleGrid,
  Text,
  Title,
  Badge,
  Avatar,
} from "@mantine/core";
import { useState, useEffect } from "react";
import {
  Plus,
  ArrowUpRight,
  Settings2,
  Globe,
  BookOpen,
  Mic,
} from "lucide-react";
import {
  api,
  Agent,
  Organization,
  Knowledge,
  defaultConfig,
  Session,
} from "../lib/api";
import { AgentEditor } from "./AgentEditor";
import { WidgetEditor } from "./WidgetEditor";
import { ErrorNotice, EmptyState } from "./ui";
export function Agents({
  org,
  agents,
  bases,
  refresh,
  start,
}: {
  org: Organization;
  agents: Agent[];
  bases: Knowledge[];
  refresh: () => void;
  start: (s: Session, agentId: string) => void;
}) {
  const [editId, setEditId] = useRouteState("agent-editor");
  const [publicationId, setPublicationId] = useRouteState("publish-agent");
  const edit =
    editId === "new"
      ? { name: "", instruction: "", kb_ids: [], config: defaultConfig }
      : agents.find((a) => a.id === editId);
  const publication = agents.find((a) => a.id === publicationId);
  const setEdit = (a: Partial<Agent> | null) =>
    setEditId(a ? a.id || "new" : null);
  const setPublication = (a: Agent | null) => setPublicationId(a?.id ?? null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function open(a: Agent, mode: "text" | "voice") {
    setBusy(a.id);
    setError("");
    try {
      start(
        await api<Session>(
          `/organizations/${org.id}/agents/${a.id}/sessions`,
          "POST",
          { mode },
        ),
        a.id,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (edit)
    return (
      <AgentEditor
        key={editId}
        value={edit}
        org={org}
        bases={bases}
        done={() => {
          setEdit(null);
          refresh();
        }}
      />
    );
  if (publication)
    return <WidgetEditor key={publicationId} agent={publication} org={org} />;
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={1} size="h2">
            Agents
          </Title>
          <Text c="dimmed" mt="xs">
            Configure your assistants and open a conversation.
          </Text>
        </div>
        {org.role !== "employee" && (
          <Button
            leftSection={<Plus size={16} />}
            onClick={() =>
              setEdit({
                name: "",
                instruction: "",
                kb_ids: [],
                config: defaultConfig,
              })
            }
          >
            Create agent
          </Button>
        )}
      </Group>
      <ErrorNotice error={error} />
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {agents.map((a) => (
          <Card key={a.id} withBorder radius="md" padding="lg">
            <Stack gap="lg">
              <Group>
                <Avatar radius="md">{a.name[0]}</Avatar>
                <div>
                  <Title order={2} size="h4">
                    {a.name}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {a.config.language === "auto"
                      ? "English + German"
                      : a.config.language}
                  </Text>
                </div>
              </Group>
              <Group gap="xs">
                <Badge variant="light">
                  {a.kb_ids.length} knowledge{" "}
                  {a.kb_ids.length === 1 ? "base" : "bases"}
                </Badge>
                <Badge color="gray" variant="light">
                  Text & voice
                </Badge>
              </Group>
              <Button
                loading={busy === a.id}
                onClick={() => open(a, "text")}
                rightSection={<ArrowUpRight size={16} />}
              >
                Open conversation
              </Button>
              {org.role !== "employee" && (
                <Group grow className="agent-actions">
                  <Button
                    variant="default"
                    leftSection={<Settings2 size={16} />}
                    onClick={() => setEdit(a)}
                  >
                    Edit agent
                  </Button>
                  <Button
                    variant="default"
                    leftSection={<Globe size={16} />}
                    onClick={() => setPublication(a)}
                  >
                    Publish agent
                  </Button>
                </Group>
              )}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      {!agents.length && <EmptyState />}
      {((editId && !edit) || (publicationId && !publication)) && (
        <ErrorNotice error="Agent unavailable or still loading. Check the link and your access." />
      )}
    </Stack>
  );
}
