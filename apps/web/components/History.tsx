"use client";
import {
  useRouteState,
  useRouteFlag,
  updateRoute,
} from "../hooks/useRouteState";
import { ActionIcon } from "./AsyncAction";
import {
  Accordion,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useState, useEffect } from "react";
import { FileText, Trash2 } from "lucide-react";
import { api, Organization, History as Conversation, Detail } from "../lib/api";
import { Markdown } from "./Markdown";
import { EmptyState, ErrorNotice, Status } from "./ui";
import { ConfirmDelete } from "./ConfirmDelete";
export function History({ org }: { org: Organization }) {
  const [conversationId, setConversationId] = useRouteState("history");
  const [deleting, setDeleting] = useRouteFlag("delete-conversation");
  const [items, setItems] = useState<Conversation[]>([]),
    [selected, setSelected] = useState<Detail | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Conversation[]>(`/organizations/${org.id}/conversations`)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [org.id]);
  useEffect(() => {
    let active = true;
    setSelected(null);
    setError("");
    if (conversationId)
      api<Detail>(`/organizations/${org.id}/conversations/${conversationId}`)
        .then((r) => {
          if (active) setSelected(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [org.id, conversationId]);
  const sourcesByDocument = new Map<string, Set<string>>();
  for (const source of selected?.sources ?? []) {
    const excerpts = sourcesByDocument.get(source.name) ?? new Set<string>();
    excerpts.add(source.excerpt.trim());
    sourcesByDocument.set(source.name, excerpts);
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Conversations</h1>
          <p>Your organization’s conversations, all in one place.</p>
        </div>
      </div>
      <ErrorNotice error={error} />
      <div className="history-layout">
        <div className="history-list">
          {items.map((c) => (
            <NavLink
              component="button"
              key={c.id}
              active={selected?.id === c.id}
              label={c.title}
              description={`${c.agent_name} · ${c.user_name || "Website visitor"}`}
              rightSection={<Status value={c.status} />}
              onClick={() => setConversationId(c.id)}
            />
          ))}
          {!items.length && <EmptyState compact />}
        </div>
        {selected && (
          <div className="history-detail">
            <Group
              justify="space-between"
              align="flex-start"
              wrap="nowrap"
              mb="md"
            >
              <Title order={3} style={{ flex: 1, minWidth: 0 }}>
                {selected.title}
              </Title>
              {org.role !== "employee" && (
                <Tooltip label="Delete conversation" withArrow>
                  <ActionIcon
                    aria-label="Delete conversation"
                    type="button"
                    color="gray"
                    variant="subtle"
                    size="lg"
                    style={{ flexShrink: 0 }}
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            {selected.messages.map((m) => (
              <div className={"message " + m.role} key={m.id}>
                <small>{m.role === "user" ? "Person" : "Agent"}</small>
                {m.role === "assistant" ? (
                  <Markdown text={m.content} />
                ) : (
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </Text>
                )}
              </div>
            ))}
            {selected.sources.length > 0 && (
              <Stack className="sources" gap="sm">
                <Text fw={600} size="sm">
                  Knowledge used
                </Text>
                <Accordion
                  key={selected.id}
                  variant="separated"
                  radius="md"
                  multiple
                >
                  {Array.from(sourcesByDocument, ([name, excerpts]) => (
                    <Accordion.Item key={name} value={name}>
                      <Accordion.Control
                        icon={<FileText size={18} aria-hidden="true" />}
                      >
                        <Text size="sm" fw={500}>
                          {name}
                        </Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          {Array.from(excerpts, (excerpt) => (
                            <Text
                              key={excerpt}
                              size="sm"
                              c="dimmed"
                              style={{ whiteSpace: "pre-wrap" }}
                            >
                              {excerpt}
                            </Text>
                          ))}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </Stack>
            )}
          </div>
        )}
      </div>
      {selected && deleting && org.role !== "employee" && (
        <ConfirmDelete
          title="Delete conversation"
          description="This permanently deletes the conversation, its messages, shared links and attached requests. Billing records are retained. This cannot be undone."
          confirmLabel="Delete conversation"
          close={() => setDeleting(false)}
          confirm={async () => {
            await api(
              `/organizations/${org.id}/conversations/${selected.id}`,
              "DELETE",
            );
            setItems((all) => all.filter((item) => item.id !== selected.id));
            setSelected(null);
            updateRoute({ history: null, "delete-conversation": null });
          }}
        />
      )}
    </>
  );
}
