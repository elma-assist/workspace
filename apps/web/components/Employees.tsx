"use client";
import { useRouteState, useRouteFlag } from "../hooks/useRouteState";
import { Button } from "./AsyncAction";
import {
  Card,
  SimpleGrid,
  Title,
  Group,
  Avatar,
  Text,
  Badge,
  Textarea,
  Stack,
  TextInput,
  Checkbox,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, Agent, Organization } from "../lib/api";
import { EditorPage, ErrorNotice } from "./ui";
interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  agent_ids: string[];
}
export function Employees({
  org,
  agents,
}: {
  org: Organization;
  agents: Agent[];
}) {
  const [invite, setInvite] = useRouteFlag("invite-teammate");
  const [memberId, setMemberId] = useRouteState("member-access");
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<Member[]>([]),
    [error, setError] = useState(""),
    [link, setLink] = useState("");
  const edit = members.find((m) => m.id === memberId);
  const setEdit = (m: Member | null) => setMemberId(m?.id ?? null);
  const base = `/organizations/${org.id}`;
  async function load() {
    setMembers(await api<Member[]>(base + "/members"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [org.id]);
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{
        url: string;
      }>(base + "/invitations", "POST", {
        name: f.get("name"),
        email: f.get("email"),
        agent_ids: f.getAll("agents"),
      });
      setLink(r.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (invite)
    return (
      <EditorPage title="Invite a teammate">
        {link ? (
          <>
            <p>
              Invitation created. Share this private link with your teammate. It
              expires in 7 days.
            </p>
            <Textarea label="Invitation link" readOnly rows={4} value={link} />
            <Button
              onClick={() => navigator.clipboard.writeText(link)}
              type="button"
              variant="filled"
            >
              Copy invitation
            </Button>
            <small className="muted">
              Local delivery: no email has been sent.
            </small>
          </>
        ) : (
          <form onSubmit={send}>
            <Stack gap="md">
              <TextInput name="name" required label="Name" />
              <TextInput name="email" type="email" required label="Email" />
              <label>Assign agents</label>
              <div className="check-list">
                {agents.map((a) => (
                  <Checkbox
                    key={a.id}
                    name="agents"
                    value={a.id}
                    label={a.name}
                  />
                ))}
              </div>
              <ErrorNotice error={error} />
              <Button loading={busy} type="submit" variant="filled" fullWidth>
                Create invitation
              </Button>
            </Stack>
          </form>
        )}
      </EditorPage>
    );
  if (edit)
    return (
      <EditorPage title={"Access for " + edit.name}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              await api(base + `/members/${edit.id}/access`, "PUT", {
                agent_ids: new FormData(e.currentTarget).getAll("agents"),
              });
              setEdit(null);
              load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Stack gap="md">
            <div className="check-list">
              {agents.map((a) => (
                <Checkbox
                  key={a.id}
                  name="agents"
                  value={a.id}
                  defaultChecked={edit.agent_ids.includes(a.id)}
                  label={a.name}
                />
              ))}
            </div>
            <Button loading={busy} type="submit" variant="filled" fullWidth>
              Save access
            </Button>
          </Stack>
        </form>
      </EditorPage>
    );
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Employees</h1>
          <p>Invite employees and manage their access to agents.</p>
        </div>
        <Button
          onClick={() => {
            setInvite(true);
            setLink("");
          }}
          type="button"
          variant="filled"
        >
          <Plus size={17} />
          Invite teammate
        </Button>
      </div>
      <ErrorNotice
        error={
          error ||
          (memberId && !edit ? "Teammate unavailable or still loading." : "")
        }
      />
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {members.map((m) => (
          <Card
            key={m.id}
            component="a"
            href={
              m.role === "employee"
                ? `/app/${org.slug}/employees/${m.id}/access`
                : undefined
            }
            withBorder
            radius="md"
            padding="lg"
            className={m.role === "employee" ? "object-card" : undefined}
            aria-label={
              m.role === "employee" ? `Edit access for ${m.name}` : undefined
            }
            onClick={(event) => {
              if (
                m.role === "employee" &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                setEdit(m);
              }
            }}
          >
            <Stack gap="lg">
              <Group wrap="nowrap" align="flex-start">
                <Avatar radius="md" style={{ flexShrink: 0 }}>
                  {m.name[0]}
                </Avatar>
                <div style={{ minWidth: 0 }}>
                  <Title order={2} size="h4">
                    {m.name}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {m.email}
                  </Text>
                </div>
              </Group>
              <Group justify="space-between" gap="xs">
                <Badge variant="light">{m.role}</Badge>
                <Text size="sm" c="dimmed">
                  {m.role === "employee"
                    ? `${m.agent_ids.length} ${m.agent_ids.length === 1 ? "agent" : "agents"}`
                    : "All agents"}
                </Text>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </>
  );
}
