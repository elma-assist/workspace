"use client";
import {
  useRouteState,
  useRouteFlag,
  updateRoute,
} from "../hooks/useRouteState";
import { Button } from "./AsyncAction";
import { Group, NavLink, Text } from "@mantine/core";
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
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
            <Group justify="space-between" align="flex-start">
              <h3>{selected.title}</h3>
              {org.role !== "employee" && (
                <Button
                  color="red"
                  variant="light"
                  leftSection={<Trash2 size={16} />}
                  onClick={() => setDeleting(true)}
                >
                  Delete conversation
                </Button>
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
              <div className="sources">
                <strong>Knowledge used</strong>
                {selected.sources.map((s, i) => (
                  <details key={i}>
                    <summary>{s.name}</summary>
                    <p>{s.excerpt}</p>
                  </details>
                ))}
              </div>
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
