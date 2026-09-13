"use client";
import {
  updateRoute,
  useRouteFlag,
  useRouteState,
} from "../hooks/useRouteState";
import { ActionIcon } from "./AsyncAction";
import { useEffect, useState, useRef, useId } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  Modal,
  Group,
  Stack,
  Text,
  TextInput,
  Loader,
  Tooltip,
  Center,
} from "@mantine/core";
import { X, Share2, PanelRight } from "lucide-react";
import { ShareConversation } from "./sharing/ShareConversation";
import { RequestPanel } from "./forms/RequestPanel";
import { Session } from "../lib/api";
import { ErrorNotice } from "./ui";
import { useConversationStatus } from "../hooks/useConversationStatus";
import { useConversation } from "../hooks/useConversation";
import { Markdown } from "./Markdown";
import { conversationStatus } from "./VoiceActivity";
import { AgentAvatar, avatarPhase } from "./AgentAvatar";
import { CallButton } from "./CallButton";
import { CallDirection } from "./CallDirection";
import { CallStatus } from "./CallStatus";
export function Chat({
  session,
  onClose,
  inline = false,
  onInitialReady,
}: {
  session: Session;
  onClose: () => void;
  inline?: boolean;
  onInitialReady?: () => void;
}) {
  const c = useConversation(session);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const initialReady = useRef(false);
  const [sharing, setSharing] = useRouteFlag("share-conversation");
  const [panelOpen, setPanelOpen] = useRouteFlag("requests-panel");
  const [activeRequest] = useRouteState("active-request");
  const lastActiveRequest = useRef("list");
  if (activeRequest) lastActiveRequest.current = activeRequest;
  const panelId = useId();
  const [formDirty, setFormDirty] = useState(false);
  const draftFlush = useRef<(() => Promise<unknown>) | null>(null);
  const syncing = useRef(false);
  const [formSyncing, setFormSyncing] = useState(false),
    [formError, setFormError] = useState("");
  async function afterDraft(action: () => Promise<void>) {
    if (syncing.current) return;
    syncing.current = true;
    setFormSyncing(true);
    setFormError("");
    try {
      await draftFlush.current?.();
      await action();
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Please save the form before continuing.",
      );
    } finally {
      syncing.current = false;
      setFormSyncing(false);
    }
  }
  const mobile = useMediaQuery("(max-width: 48em)");
  const [opened, setOpened] = useState(false);
  useEffect(() => setOpened(true), []);
  const close = () =>
    afterDraft(async () => {
      await c.flush();
      inline ? onClose() : setOpened(false);
    });
  const status = useConversationStatus(
    conversationStatus(
      c.state,
      c.pending,
      c.muted,
      c.levels.user,
      c.mode === "voice",
    ),
  );
  const busy = /Connecting|Reconnecting|Processing/.test(status);
  const ready = ![
    "connecting",
    "initializing",
    "reconnecting",
    "disconnected",
    "error",
  ].includes(c.state.toLowerCase());
  useEffect(() => {
    if (
      !initialReady.current &&
      !requestsLoading &&
      (ready || /disconnected|error/i.test(c.state))
    ) {
      initialReady.current = true;
      onInitialReady?.();
    }
  }, [requestsLoading, ready, c.state, onInitialReady]);
  const content = (
    <div className={`chat-workspace ${panelOpen ? "with-requests" : ""}`}>
      <section
        className={inline ? "conversation conversation-inline" : "conversation"}
      >
        <Group p="md" justify="space-between" className="conversation-header">
          <Group gap="sm" wrap="nowrap" className="conversation-identity">
            <AgentAvatar
              name={session.agent_name}
              status={status}
              phase={avatarPhase(c.state, c.pending, c.mode === "voice")}
              level={c.levels.agent}
              online={ready}
            />
            <div>
              <Text fw={600} truncate title={session.agent_name}>
                {session.agent_name}
              </Text>
              <Text
                size="xs"
                c="dimmed"
                lineClamp={2}
                className="agent-description"
                title={session.agent_description || "AI assistant"}
              >
                {session.agent_description || "AI assistant"}
              </Text>
            </div>
          </Group>
          <Group gap="xs" wrap="nowrap" className="conversation-header-actions">
            <Tooltip label="Share conversation">
              <ActionIcon
                variant="subtle"
                size={36}
                aria-label="Share conversation"
                onClick={() => setSharing(true)}
              >
                <Share2 size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={panelOpen ? "Close side panel" : "Open side panel"}>
              <ActionIcon
                size={36}
                variant={panelOpen ? "light" : "subtle"}
                aria-label={panelOpen ? "Close side panel" : "Open side panel"}
                aria-expanded={panelOpen}
                aria-controls={panelId}
                onClick={() => {
                  if (panelOpen) setPanelOpen(false);
                  else
                    updateRoute({
                      "requests-panel": "open",
                      "active-request": lastActiveRequest.current,
                    });
                }}
              >
                <PanelRight size={18} aria-hidden="true" />
              </ActionIcon>
            </Tooltip>
            <Tooltip
              label={
                formDirty
                  ? "Save draft and close conversation"
                  : "Close conversation"
              }
            >
              <ActionIcon
                variant="subtle"
                size={44}
                aria-label="Close conversation"
                onClick={close}
              >
                <X size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <div
          className="chat-messages"
          role="log"
          aria-label="Conversation messages"
        >
          {!c.messages.length && (
            <Center h="100%">
              <Stack align="center" gap="xs">
                <Text fw={500}>
                  {busy ? "Connecting to your agent" : "Start a conversation"}
                </Text>
                <Text size="sm" c="dimmed">
                  Ask a question in English or German.
                </Text>
              </Stack>
            </Center>
          )}
          {c.messages.map((m) => (
            <div className={`message ${m.role}`} key={m.id}>
              <Text size="xs" c="dimmed" mb="xs">
                {m.role === "assistant" ? session.agent_name : "You"}
              </Text>
              {m.role === "assistant" ? (
                <Markdown text={m.content} />
              ) : (
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {m.content}
                </Text>
              )}
            </div>
          ))}
          <div ref={c.end} />
        </div>
        <div className="conversation-controls">
          <Stack gap="sm">
            <ErrorNotice error={formError || c.error} />
            <Group
              component="form"
              gap="xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (!ready || c.pending || formSyncing || !c.input.trim())
                  return;
                void afterDraft(() => c.send(e));
              }}
              wrap="nowrap"
            >
              <TextInput
                flex={1}
                miw={0}
                aria-label="Message"
                enterKeyHint="send"
                value={c.input}
                onChange={(e) => c.setInput(e.target.value)}
                placeholder="Message your agent · Enter to send"
                aria-busy={c.pending || formSyncing}
                rightSection={
                  c.pending || formSyncing ? (
                    <Loader size="xs" aria-label="Sending message" />
                  ) : null
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.nativeEvent.isComposing)
                    e.preventDefault();
                }}
              />
              <Group
                gap={6}
                wrap="nowrap"
                className="call-participants"
                style={{ flexShrink: 0 }}
              >
                {(c.mode === "voice" || c.switching) && (
                  <>
                    <AgentAvatar
                      name={session.agent_name}
                      status={status}
                      phase={avatarPhase(
                        c.state,
                        c.pending,
                        c.mode === "voice",
                      )}
                      level={c.levels.agent}
                      online={ready}
                      size={40}
                      announce={false}
                    />
                    <CallDirection
                      active={
                        c.mode === "voice" &&
                        ready &&
                        c.microphoneEnabled &&
                        !c.switching
                      }
                      agentSpeaking={c.state.toLowerCase() === "speaking"}
                      userLevel={c.levels.user}
                      agentLevel={c.levels.agent}
                    />
                  </>
                )}
                <CallButton
                  active={c.mode === "voice" && ready && c.microphoneEnabled}
                  voice={c.mode === "voice"}
                  level={c.levels.user}
                  loading={c.switching}
                  disabled={c.mode !== "voice" && !ready}
                  onClick={() =>
                    c.mode === "voice"
                      ? c.switchMode()
                      : afterDraft(c.switchMode)
                  }
                />
              </Group>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                AI can make mistakes.
              </Text>
              <CallStatus
                voice={c.mode === "voice"}
                connected={ready && c.microphoneEnabled && !c.switching}
                switching={c.switching}
                state={c.state}
              />
            </Group>
          </Stack>
        </div>
        <div ref={c.audio} />
      </section>
      <aside id={panelId} className="conversation-request-pane">
        <RequestPanel
          session={session}
          onLoadingChange={setRequestsLoading}
          onNew={(requestId) => {
            if (requestId)
              updateRoute({
                "requests-panel": "open",
                "active-request": requestId,
              });
            else setPanelOpen(true);
          }}
          onDirty={setFormDirty}
          onFlush={(fn) => {
            draftFlush.current = fn;
          }}
        />
      </aside>
    </div>
  );
  const view = inline ? (
    content
  ) : (
    <Modal
      opened={opened}
      onClose={() => {
        void close();
      }}
      onExitTransitionEnd={onClose}
      withCloseButton={false}
      title={null}
      aria-label={`Conversation with ${session.agent_name}`}
      centered
      padding={0}
      size={panelOpen ? 1040 : "lg"}
      fullScreen={mobile}
    >
      {content}
    </Modal>
  );
  return (
    <>
      {view}
      {sharing && (
        <ShareConversation
          session={session}
          close={() => setSharing(false)}
          flush={async () => {
            await draftFlush.current?.();
            await c.flush();
          }}
        />
      )}
    </>
  );
}
