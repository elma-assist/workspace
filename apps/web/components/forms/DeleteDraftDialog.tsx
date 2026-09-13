"use client";
import { useState } from "react";
import { Group, Text } from "@mantine/core";
import { Button } from "../AsyncAction";
import { Modal, ErrorNotice } from "../ui";
import { formFetch, requestBase, type RequestRecord } from "../../lib/forms";
import type { Session } from "../../lib/api";

export function DeleteDraftDialog({
  record,
  session,
  close,
  deleted,
}: {
  record: RequestRecord;
  session: Session;
  close: () => void;
  deleted: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`Delete draft ${record.code}`}
      onClose={() => {
        if (!busy) close();
      }}
      closeDisabled={busy}
      compact
    >
      <Text size="sm">
        Delete request {record.code} — {record.snapshot.name}? Its answers and
        photos will no longer be available. This cannot be undone.
      </Text>
      <ErrorNotice error={error} />
      <Group justify="flex-end">
        <Button variant="default" disabled={busy} onClick={close}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={busy}
          disabled={record.status !== "draft"}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await formFetch(
                `${requestBase(session)}/requests/${record.id}`,
                session,
                "DELETE",
              );
              deleted();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete draft
        </Button>
      </Group>
    </Modal>
  );
}
