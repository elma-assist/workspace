"use client";
import {
  useRouteState,
  useRouteFlag,
  updateRoute,
} from "../hooks/useRouteState";
import { Button, ActionIcon } from "./AsyncAction";
import {
  Stack,
  TextInput,
  Textarea,
  Table,
  Group,
  Title,
  Text,
  Paper,
  SimpleGrid,
  Card,
  Tooltip,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { Plus, FileText, UploadCloud, Download } from "lucide-react";
import { api, Knowledge as KB, Document, Organization } from "../lib/api";
import { EditorPage, ErrorNotice, Status, EmptyState } from "./ui";
export function Knowledge({
  org,
  bases,
  refresh,
}: {
  org: Organization;
  bases: KB[];
  refresh: () => void;
}) {
  const [kbId, setKbId] = useRouteState("knowledge-base");
  const selected = bases.find((b) => b.id === kbId) ?? null;
  const setSelected = (b: KB | null) => setKbId(b?.id ?? null);
  const [create, setCreate] = useRouteFlag("create-knowledge");
  const [upload, setUpload] = useRouteFlag("add-document");
  const [docs, setDocs] = useState<Document[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const base = `/organizations/${org.id}/knowledge`;
  async function load() {
    if (selected)
      setDocs(await api<Document[]>(`${base}/${selected.id}/documents`));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const timer = setInterval(() => load().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [selected?.id, org.id]);
  async function newBase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api(base, "POST", {
        name: new FormData(e.currentTarget).get("name"),
      });
      setCreate(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addDoc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const file = f.get("file") as File;
    try {
      let text = String(f.get("text") || "");
      let name = String(f.get("name") || "");
      if (file?.size) {
        if (file.size > 200000)
          throw new Error("Use a text document smaller than 200 KB");
        text = await file.text();
        name = name || file.name;
      }
      await api(`${base}/${selected!.id}/documents`, "POST", {
        name: name || "Untitled document",
        text,
      });
      setUpload(false);
      await load();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (create)
    return (
      <EditorPage title="Create knowledge base">
        <form onSubmit={newBase}>
          <Stack>
            <TextInput
              label="Name"
              name="name"
              placeholder="e.g. Company handbook"
              required
            />
            <ErrorNotice error={error} />
            <Button type="submit" loading={busy}>
              Create knowledge base
            </Button>
          </Stack>
        </form>
      </EditorPage>
    );
  if (upload && selected)
    return (
      <EditorPage title="Add document">
        <form onSubmit={addDoc}>
          <Stack>
            <TextInput
              type="file"
              name="file"
              label="Choose a text document"
              description=".txt or .md · up to 200 KB"
              accept=".txt,.md,text/plain"
            />
            <TextInput
              label="Document title"
              name="name"
              placeholder="Optional when uploading a file"
            />
            <Textarea label="Or paste text" name="text" rows={6} />
            <ErrorNotice error={error} />
            <Button type="submit" loading={busy}>
              Add & index document
            </Button>
          </Stack>
        </form>
      </EditorPage>
    );
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={1} size="h2">
            {selected?.name || "Knowledge bases"}
          </Title>
          <Text c="dimmed" mt="xs">
            Upload documents and track their indexing status.
          </Text>
        </div>
        <Button
          leftSection={<Plus size={16} />}
          onClick={() => (selected ? setUpload(true) : setCreate(true))}
        >
          {selected ? "Add document" : "New knowledge base"}
        </Button>
      </Group>
      <ErrorNotice
        error={
          error ||
          (kbId && !selected
            ? "Knowledge base unavailable or still loading."
            : "")
        }
      />
      {selected ? (
        <Paper withBorder radius="md">
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Document</Table.Th>
                  <Table.Th>Indexing status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {docs.map((d) => (
                  <Table.Tr key={d.id} className="document-row">
                    <Table.Td>
                      <Group wrap="nowrap">
                        <FileText size={18} />
                        <div>
                          <Text size="sm" fw={500}>
                            {d.name}
                          </Text>
                          {d.error && (
                            <Text size="xs" c="red">
                              {d.error}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Status value={d.status} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {d.status === "failed" && (
                          <Button
                            size="xs"
                            variant="light"
                            onClick={async () => {
                              try {
                                await api(
                                  `${base}/documents/${d.id}/retry`,
                                  "POST",
                                );
                                await load();
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            Retry
                          </Button>
                        )}
                        <Tooltip label="Download document">
                          <ActionIcon
                            variant="subtle"
                            aria-label={`Download ${d.name}`}
                            onClick={async () => {
                              try {
                                const r = await api<{
                                  url: string;
                                }>(`${base}/documents/${d.id}/download`);
                                window.open(r.url, "_blank", "noopener");
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            <Download size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {!docs.length && <EmptyState />}
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {bases.map((b) => (
            <Card
              key={b.id}
              component="button"
              type="button"
              withBorder
              radius="md"
              padding="lg"
              className="knowledge-card"
              aria-label={`Open ${b.name}`}
              onClick={() => {
                setDocs([]);
                setSelected(b);
              }}
            >
              <Stack>
                <Group>
                  <FileText size={20} />
                  <Title order={2} size="h4">
                    {b.name}
                  </Title>
                </Group>
                <Text size="sm" c="dimmed">
                  {b.documents} documents · {b.ready} indexed
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
      {!selected && !bases.length && <EmptyState />}
    </Stack>
  );
}
