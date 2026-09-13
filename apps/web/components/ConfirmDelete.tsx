"use client";

import { Group, Text } from "@mantine/core";
import { useState } from "react";
import { Button } from "./AsyncAction";
import { ErrorNotice, Modal } from "./ui";

export function ConfirmDelete({
  title,
  description,
  confirmLabel = "Delete",
  close,
  confirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  close: () => void;
  confirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) close();
      }}
      closeDisabled={busy}
      compact
    >
      <Text size="sm">{description}</Text>
      <ErrorNotice error={error} />
      <Group justify="flex-end">
        <Button variant="default" disabled={busy} onClick={close}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await confirm();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
