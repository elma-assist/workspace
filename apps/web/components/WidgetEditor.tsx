"use client";
import { Button } from "./AsyncAction";
import { useState, useEffect } from "react";
import { Stack, Textarea, Checkbox, Text, Divider } from "@mantine/core";
import { api, Agent, Organization } from "../lib/api";
import type { components } from "../../../packages/contracts/api";
import { EditorPage, ErrorNotice } from "./ui";
import { LinkQr } from "./sharing/LinkQr";
type Publication = components["schemas"]["Publication"];

export function WidgetEditor({
  agent,
  org,
}: {
  agent: Agent;
  org: Organization;
}) {
  const [publication, setPublication] = useState<Publication | null>(null),
    [error, setError] = useState("");
  const [origins, setOrigins] = useState(""),
    [enabled, setEnabled] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const path = `/organizations/${org.id}/agents/${agent.id}/publication`;
  useEffect(() => {
    api<Publication | null>(path)
      .then((p) => {
        setPublication(p);
        setOrigins(p?.origins.join("\n") || "");
        setEnabled(p?.enabled || false);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [path]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setPublication(
        await api<Publication>(path, "PUT", {
          enabled,
          origins: origins
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <EditorPage title={"Publish " + agent.name}>
      <Text size="sm">
        Publish a page anyone can open by link or QR code. Each visitor gets
        their own conversation. Connected knowledge and forms become available
        through the agent.
      </Text>
      <form onSubmit={save}>
        <Stack gap="md">
          <Checkbox
            disabled={!loaded || busy}
            checked={enabled}
            onChange={(e) => setEnabled(e.currentTarget.checked)}
            label="Publish agent"
          />
          <Textarea
            disabled={!loaded || busy}
            value={origins}
            onChange={(e) => setOrigins(e.currentTarget.value)}
            label="Allowed website origins"
            placeholder="https://your-website.com"
            description="Optional: websites where you will embed the widget. The public agent page works without these."
          />
          <ErrorNotice error={error} />
          <Button disabled={!loaded} loading={busy} type="submit">
            Save publication
          </Button>
        </Stack>
      </form>
      {publication?.enabled && (
        <>
          <Divider label="Public agent link" />
          <LinkQr url={publication.url} filename="elma-agent-qr" />
          <Divider label="Embed on a website" />
          <Textarea
            readOnly
            value={publication.embed}
            rows={3}
            label="Paste before the closing body tag"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="light"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publication.embed);
              } catch {
                setError("Select and copy the embed code manually.");
              }
            }}
          >
            Copy code
          </Button>
        </>
      )}
      {publication && !publication.enabled && (
        <Text c="dimmed" size="sm">
          Unpublished. Public and shared conversation links cannot open this
          agent.
        </Text>
      )}
    </EditorPage>
  );
}
