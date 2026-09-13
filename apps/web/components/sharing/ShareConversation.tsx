"use client";
import { Button } from "../AsyncAction";
import { useEffect, useState } from "react";
import { Text, Loader } from "@mantine/core";
import { Modal, ErrorNotice } from "../ui";
import { Session } from "../../lib/api";
import { formFetch, requestBase } from "../../lib/forms";
import { LinkQr } from "./LinkQr";
import type { components } from "../../../../packages/contracts/api";

export function ShareConversation({
  session,
  close,
  flush,
}: {
  session: Session;
  close: () => void;
  flush: () => Promise<void>;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revoked, setRevoked] = useState(false);
  useEffect(() => {
    let active = true;
    flush()
      .then(() =>
        formFetch<components["schemas"]["ShareLink"]>(
          requestBase(session) + "/share",
          session,
          "POST",
        ),
      )
      .then((r) => {
        if (active) setUrl(r.url);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [session.id]);
  return (
    <Modal title="Share conversation" onClose={close} compact>
      <Text size="sm">
        Anyone with this link can continue this conversation and access its
        requests.
      </Text>
      {!url && !error && !revoked && <Loader size="sm" />}
      {url && <LinkQr url={url} compact />}
      {url && (
        <Text size="xs" c="dimmed">
          Continuing on another device disconnects the current connection.
        </Text>
      )}
      <ErrorNotice error={error} />
      {revoked && (
        <Text c="green">
          All previous conversation links have been revoked.
        </Text>
      )}
      {!session.shared_access && url && (
        <Button
          color="red"
          variant="subtle"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await formFetch(
                requestBase(session) + "/share",
                session,
                "DELETE",
              );
              setUrl("");
              setRevoked(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Revoke all conversation links
        </Button>
      )}
    </Modal>
  );
}
