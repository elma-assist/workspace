"use client";
import { useRouteState, updateRoute } from "../../hooks/useRouteState";
import { Button } from "../AsyncAction";
import { useEffect, useState, useRef } from "react";
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  LoadingOverlay,
} from "@mantine/core";
import { Mic, MessageSquare } from "lucide-react";
import { api, Session } from "../../lib/api";
import type { components } from "../../../../packages/contracts/api";
import { Chat } from "../Chat";
import { ErrorNotice, Logo } from "../ui";

export function PublicConversation({
  agentPath,
  widgetId,
  initialConversationId = "",
}: {
  agentPath?: string;
  widgetId?: string;
  initialConversationId?: string;
}) {
  const publicAgent = !!(agentPath || widgetId);
  const [publicId, setPublicId] = useState("");
  const [description, setDescription] = useState("");
  const [conversationId] = useRouteState(
    "conversation",
    "",
    initialConversationId
      ? `?conversation=${encodeURIComponent(initialConversationId)}`
      : "",
  );
  const [infoLoading, setInfoLoading] = useState(true);
  const [chatReady, setChatReady] = useState(false);
  const attempted = useRef("");
  const [name, setName] = useState(""),
    [token, setToken] = useState(""),
    [title, setTitle] = useState("");
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setInfoLoading(true);
    if (publicAgent) {
      api<components["schemas"]["PublicAgent"]>(
        widgetId
          ? `/public/widgets/${widgetId}`
          : `/public/agents/${agentPath}`,
      )
        .then((r) => {
          if (active) {
            setPublicId(r.publication_id);
            setName(r.name);
            setDescription(r.description);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setInfoLoading(false);
        });
    } else {
      let version = 0;
      const load = () => {
        const current = ++version;
        setInfoLoading(true);
        const secret = location.hash.slice(1);
        setToken(secret);
        setName("");
        setTitle("");
        setError("");
        setSession(null);
        if (!secret) {
          setError("The conversation link is incomplete.");
          setInfoLoading(false);
          return;
        }
        api<components["schemas"]["SharedConversation"]>(
          "/public/shared/info",
          "POST",
          { token: secret },
        )
          .then((r) => {
            if (active && current === version) {
              setName(r.agent_name);
              setTitle(r.title);
            }
          })
          .catch((e) => {
            if (active && current === version) setError(e.message);
          })
          .finally(() => {
            if (active && current === version) setInfoLoading(false);
          });
      };
      load();
      window.addEventListener("hashchange", load);
      return () => {
        active = false;
        window.removeEventListener("hashchange", load);
      };
    }
    return () => {
      active = false;
    };
  }, [agentPath, widgetId]);
  async function start(mode: "text" | "voice") {
    setBusy(true);
    setChatReady(false);
    setError("");
    try {
      let result: Session;
      if (publicAgent) {
        if (!publicId) throw new Error("Agent is still loading");
        const prefix = location.origin + "-" + publicId;
        let visitor = "",
          conversation: string | null = null;
        try {
          visitor = localStorage.getItem("elma-visitor-" + prefix) || "";
          conversation =
            conversationId ||
            localStorage.getItem("elma-conversation-" + prefix);
        } catch {}
        const response = await fetch(`/api/public/${publicId}/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Visitor-Token": visitor,
          },
          body: JSON.stringify({ mode, conversation_id: conversation }),
        });
        if (!response.ok)
          throw new Error(
            (await response.json()).detail || "Could not connect",
          );
        result = await response.json();
        try {
          localStorage.setItem(
            "elma-visitor-" + prefix,
            result.visitor_token || "",
          );
          localStorage.setItem("elma-conversation-" + prefix, result.id);
        } catch {}
      } else {
        result = await api<Session>("/public/shared/sessions", "POST", {
          token,
          mode,
        });
      }
      setSession(result);
      updateRoute({ conversation: result.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!conversationId) {
      setSession(null);
      attempted.current = "";
      return;
    }
    const key = `${publicId || token}:${conversationId}`;
    if (
      !name ||
      busy ||
      session?.id === conversationId ||
      attempted.current === key
    )
      return;
    attempted.current = key;
    void start("text");
  }, [conversationId, name, token, publicId]);
  return (
    <main className="public-agent-page">
      <header>
        <Logo />
      </header>
      {session || conversationId ? (
        <div
          className="public-agent-chat"
          aria-busy={!error && (!session || !chatReady)}
        >
          <LoadingOverlay
            visible={!error && (!session || !chatReady)}
            overlayProps={{ backgroundOpacity: 1, blur: 0 }}
            loaderProps={{ "aria-label": "Loading conversation" }}
            zIndex={10}
            transitionProps={{ duration: 0 }}
          />
          {error && (
            <Stack p="xl">
              <ErrorNotice error={error} />
              <Button onClick={() => start("text")} loading={busy}>
                Retry
              </Button>
            </Stack>
          )}
          {session && (
            <div
              className="public-agent-chat-content"
              style={{ visibility: chatReady ? "visible" : "hidden" }}
              inert={!chatReady}
            >
              <Chat
                key={`${session.id}:${session.token}`}
                inline
                session={session}
                onInitialReady={() => setChatReady(true)}
                onClose={() => {
                  setSession(null);
                  updateRoute({
                    conversation: null,
                    "requests-panel": null,
                    "active-request": null,
                    "delete-request": null,
                    "share-conversation": null,
                    photo: null,
                  });
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <Paper
          withBorder
          radius="lg"
          p="xl"
          w="100%"
          maw={480}
          mx="auto"
          pos="relative"
          mih={320}
        >
          <LoadingOverlay
            visible={infoLoading}
            overlayProps={{ backgroundOpacity: 1, blur: 0 }}
            loaderProps={{ "aria-label": "Loading agent" }}
            transitionProps={{ duration: 0 }}
          />
          <Stack
            gap="lg"
            style={{ visibility: infoLoading ? "hidden" : "visible" }}
            inert={infoLoading}
          >
            <Title order={1}>
              {name ? `Talk to ${name}` : "Open conversation"}
            </Title>
            {publicAgent && description && (
              <Text
                className="public-agent-description"
                style={{ overflowWrap: "anywhere" }}
              >
                {description}
              </Text>
            )}
            <Text c="dimmed">
              {publicAgent
                ? "Ask a question by text or voice. No account needed."
                : "Continue this shared conversation with its history and requests."}
            </Text>
            {!publicAgent && title && <Text size="sm">{title}</Text>}
            {!publicAgent && (
              <Text size="sm" c="dimmed">
                Starting here disconnects the previous live connection.
                Conversation history and saved requests remain available.
              </Text>
            )}
            <ErrorNotice error={error} />
            <Group grow>
              <Button
                disabled={!name}
                loading={busy}
                leftSection={<MessageSquare size={16} />}
                onClick={() => start("text")}
              >
                {publicAgent ? "Start a chat" : "Continue chat"}
              </Button>
              <Button
                variant="light"
                disabled={!name}
                loading={busy}
                leftSection={<Mic size={16} />}
                onClick={() => start("voice")}
              >
                Use voice
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              You are speaking with an AI assistant.
            </Text>
          </Stack>
        </Paper>
      )}
    </main>
  );
}
