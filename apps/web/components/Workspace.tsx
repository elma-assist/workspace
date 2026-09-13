"use client";
import {
  useRouteState,
  useRouteFlag,
  useRoutePath,
  updateRoute,
} from "../hooks/useRouteState";
import { Button, ActionIcon } from "./AsyncAction";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { isWorkspaceSection } from "../lib/workspaceRoutes";
import {
  AppShell,
  Anchor,
  Breadcrumbs,
  Burger,
  Group,
  Stack,
  Text,
  Title,
  NavLink,
  Avatar,
  Tooltip,
  Paper,
  TextInput,
  Alert,
  Loader,
  Center,
  Container,
} from "@mantine/core";
import {
  Bot,
  BookOpen,
  Users,
  MessageSquare,
  ChartNoAxesCombined,
  Settings,
  ClipboardList,
  FileText,
  LogOut,
  ChevronRight,
  Building2,
} from "lucide-react";
import {
  api,
  User,
  Organization,
  Agent,
  Knowledge as KB,
  Session,
} from "../lib/api";
import { Logo, Modal, EditorPage, ErrorNotice } from "./ui";
import { Auth } from "./Auth";
import { Agents } from "./Agents";
import { Knowledge } from "./Knowledge";
import { Employees } from "./Employees";
import { Usage } from "./Usage";
import { History } from "./History";
import { Chat } from "./Chat";
import { Forms } from "./forms/Forms";
import { Requests } from "./forms/Requests";
import { Organizations } from "./Organizations";
type Page =
  | "Agents"
  | "Knowledge"
  | "Conversations"
  | "Employees"
  | "Usage"
  | "Settings"
  | "Forms"
  | "Requests";
const navigation = [
  { name: "Agents", icon: Bot },
  { name: "Knowledge", icon: BookOpen },
  { name: "Forms", icon: FileText },
  { name: "Requests", icon: ClipboardList },
  { name: "Conversations", icon: MessageSquare },
  { name: "Employees", icon: Users },
  { name: "Usage", icon: ChartNoAxesCombined },
  { name: "Settings", icon: Settings },
] as const;
export function Workspace() {
  const router = useRouter(),
    nextPathname = usePathname(),
    pathname = useRoutePath(nextPathname);
  const rawSlug = decodeURIComponent(pathname.split("/")[2] || "");
  const slug = rawSlug === "new" ? "" : rawSlug;
  const section = pathname.split("/")[3] || "agents";
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Organization[]>([]),
    [orgsLoaded, setOrgsLoaded] = useState(false);
  const org = orgs.find((o) => o.slug === slug);
  const [agents, setAgents] = useState<Agent[]>([]),
    [bases, setBases] = useState<KB[]>([]);
  const page: Page =
    navigation.find((n) => n.name.toLowerCase() === section)?.name ?? "Agents";
  const routeParts = pathname.split("/").filter(Boolean).slice(3);
  const detailLabel = (() => {
    if (rawSlug === "new") return "Create organization";
    if (!routeParts.length) return "";
    if (section === "agents") {
      if (routeParts[0] === "new") return "Create agent";
      if (routeParts[1] === "edit") return "Edit agent";
      if (routeParts[1] === "publish") return "Publish agent";
      if (routeParts[1] === "conversations") return "Conversation";
    }
    if (section === "knowledge") {
      if (routeParts[0] === "new") return "Create knowledge base";
      if (routeParts[1] === "add-document") return "Add document";
      return (
        bases.find((base) => base.id === decodeURIComponent(routeParts[0]))
          ?.name || "Knowledge base"
      );
    }
    if (section === "forms")
      return routeParts[0] === "new" ? "Create form" : "Edit form";
    if (section === "employees")
      return routeParts[0] === "invite" ? "Invite teammate" : "Edit access";
    if (section === "requests") return "Request details";
    if (section === "conversations") return "Conversation";
    return "";
  })();
  const [mobile, setMobile] = useState(false);
  const [chatId] = useRouteState("conversation");
  const [chatAgent] = useRouteState("chat-agent");
  const [restoring, setRestoring] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrg, setNewOrg] = useRouteFlag("create-organization");
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const loadOrgs = useCallback(async () => {
    setOrgs(await api<Organization[]>("/organizations"));
    setOrgsLoaded(true);
  }, []);
  useEffect(() => {
    if (user) loadOrgs().catch((e) => setError(e.message));
  }, [user, loadOrgs]);
  const activeOrganization = useRef(org?.id);
  activeOrganization.current = org?.id;
  const refresh = useCallback(async () => {
    if (!org) return;
    const [a, b] = await Promise.all([
      api<Agent[]>(`/organizations/${org.id}/agents`),
      org.role !== "employee"
        ? api<KB[]>(`/organizations/${org.id}/knowledge`)
        : Promise.resolve([]),
    ]);
    if (activeOrganization.current !== org.id) return;
    setAgents(a);
    setBases(b);
  }, [org?.id, org?.role]);
  useEffect(() => {
    setAgents([]);
    setBases([]);
    setSession(null);
    setError("");
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (!org || !chatId || !chatAgent) {
      setRestoring(false);
      setSession(null);
      return;
    }
    if (session?.id === chatId) return;
    let active = true;
    setRestoring(true);
    api<Session>(
      `/organizations/${org.id}/agents/${chatAgent}/sessions`,
      "POST",
      {
        mode: "text",
        conversation_id: chatId,
      },
    )
      .then((result) => {
        if (active) setSession(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [org?.id, chatId, chatAgent]);
  function startSession(next: Session, agentId: string) {
    setSession(next);
    updateRoute({ conversation: next.id, "chat-agent": agentId });
  }
  function closeSession() {
    setSession(null);
    updateRoute({
      conversation: null,
      "chat-agent": null,
      "share-conversation": null,
      photo: null,
      "requests-panel": null,
      "active-request": null,
      "delete-request": null,
    });
  }
  function go(path: string) {
    setSession(null);
    setMobile(false);
    router.push(path);
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const next = await api<Organization>("/organizations", "POST", {
        name: new FormData(e.currentTarget).get("name"),
      });
      await loadOrgs();
      setNewOrg(false);
      go(`/app/${next.slug}/agents`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }
  if (slug && !isWorkspaceSection(section)) return null;
  if (loading)
    return (
      <Center h="100dvh">
        <Loader aria-label="Loading workspace" />
      </Center>
    );
  if (!user) return <Auth onDone={setUser} />;
  return (
    <AppShell
      header={{ height: 64 }}
      navbar={
        org
          ? { width: 240, breakpoint: "sm", collapsed: { mobile: !mobile } }
          : undefined
      }
      padding={{ base: "md", sm: "xl" }}
    >
      <AppShell.Header>
        <Group justify="space-between" h="100%" px="lg">
          <Group>
            {org && (
              <Burger
                opened={mobile}
                onClick={() => setMobile((v) => !v)}
                hiddenFrom="sm"
                size="sm"
                aria-label="Toggle navigation"
              />
            )}
            <Logo />
          </Group>
          <Group>
            <Text size="sm" c="dimmed" visibleFrom="sm">
              {user.name}
            </Text>
            <Tooltip label="Sign out">
              <ActionIcon
                variant="subtle"
                aria-label="Sign out"
                onClick={async () => {
                  await api("/auth/logout", "POST");
                  setUser(null);
                  setSession(null);
                  setOrgs([]);
                  setOrgsLoaded(false);
                  go("/app");
                }}
              >
                <LogOut size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>
      {org && (
        <AppShell.Navbar>
          <Group gap="sm" px="xs" py="md">
            <Avatar radius="md">
              <Building2 size={20} />
            </Avatar>
            <div>
              <Text fw={600} size="sm">
                {org.name}
              </Text>
              <Text size="xs" c="dimmed" tt="capitalize">
                {org.role}
              </Text>
            </div>
          </Group>
          <Stack gap={4} mt="md">
            {navigation
              .filter(
                (n) =>
                  org.role !== "employee" ||
                  ["Agents", "Conversations", "Requests"].includes(n.name),
              )
              .map((n) => (
                <NavLink
                  key={n.name}
                  component={Link}
                  href={`/app/${org.slug}/${n.name.toLowerCase()}`}
                  active={page === n.name}
                  label={n.name}
                  leftSection={<n.icon size={18} />}
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    setError("");
                    setMobile(false);
                  }}
                />
              ))}
          </Stack>
        </AppShell.Navbar>
      )}
      <AppShell.Main>
        <Container size="xl" p={0}>
          <Stack gap="xl">
            {(org || detailLabel) && (
              <Breadcrumbs
                aria-label="Breadcrumbs"
                className="workspace-breadcrumbs"
                separator={<ChevronRight size={14} aria-hidden="true" />}
              >
                <Anchor
                  size="sm"
                  href="/app"
                  onClick={(e) => {
                    e.preventDefault();
                    go("/app");
                  }}
                >
                  My organizations
                </Anchor>
                {org && (
                  <Anchor
                    size="sm"
                    href={`/app/${org.slug}/agents`}
                    onClick={(e) => {
                      e.preventDefault();
                      go(`/app/${org.slug}/agents`);
                    }}
                  >
                    {org.name}
                  </Anchor>
                )}
                {org && detailLabel ? (
                  <Anchor
                    size="sm"
                    href={`/app/${org.slug}/${section}`}
                    onClick={(e) => {
                      e.preventDefault();
                      go(`/app/${org.slug}/${section}`);
                    }}
                  >
                    {page}
                  </Anchor>
                ) : org ? (
                  <Text size="sm">{page}</Text>
                ) : null}
                {detailLabel ? <Text size="sm">{detailLabel}</Text> : null}
              </Breadcrumbs>
            )}
            <ErrorNotice error={error} />
            {!orgsLoaded ? (
              <Loader aria-label="Loading organizations" />
            ) : newOrg ? (
              <EditorPage title="Create organization">
                <form onSubmit={create}>
                  <Stack>
                    <TextInput
                      label="Organization name"
                      name="name"
                      placeholder="Your company"
                      required
                    />
                    <ErrorNotice error={error} />
                    <Button type="submit" loading={creating}>
                      Create organization
                    </Button>
                  </Stack>
                </form>
              </EditorPage>
            ) : !slug ? (
              <Organizations
                items={orgs}
                open={(o) => go(`/app/${o.slug}/agents`)}
                create={() => setNewOrg(true)}
              />
            ) : !org ? (
              <Alert color="red" title="Organization unavailable">
                This organization does not exist or you do not have access.
              </Alert>
            ) : (
              <>
                {page === "Agents" && (
                  <Agents
                    key={org.id}
                    org={org}
                    agents={agents}
                    bases={bases}
                    refresh={refresh}
                    start={startSession}
                  />
                )}
                {page === "Knowledge" && (
                  <Knowledge
                    key={org.id}
                    org={org}
                    bases={bases}
                    refresh={refresh}
                  />
                )}
                {page === "Forms" && <Forms key={org.id} org={org} />}
                {page === "Requests" && <Requests key={org.id} org={org} />}
                {page === "Employees" && (
                  <Employees key={org.id} org={org} agents={agents} />
                )}
                {page === "Usage" && <Usage key={org.id} org={org} />}
                {page === "Conversations" && <History key={org.id} org={org} />}
                {page === "Settings" && (
                  <Stack>
                    <Title order={1} size="h2">
                      Organization settings
                    </Title>
                    <Paper withBorder p="lg">
                      <Stack maw={560}>
                        <TextInput
                          label="Organization name"
                          readOnly
                          value={org.name}
                        />
                        <TextInput
                          label="Organization slug"
                          readOnly
                          value={org.slug}
                        />
                        <Alert>
                          Conversation history is shared within this
                          organization. Data is retained. A negative balance
                          does not interrupt your agents.
                        </Alert>
                      </Stack>
                    </Paper>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Container>
      </AppShell.Main>
      {restoring && (
        <Modal title="Opening conversation" onClose={closeSession}>
          <Loader aria-label="Restoring conversation" />
        </Modal>
      )}
      {session && chatId === session.id && (
        <Chat key={session.token} session={session} onClose={closeSession} />
      )}
    </AppShell>
  );
}
