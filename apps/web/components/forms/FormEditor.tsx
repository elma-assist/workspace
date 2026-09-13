"use client";
import { Button, ActionIcon } from "../AsyncAction";
import { useState } from "react";
import {
  Stack,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Paper,
  Group,
  Text,
  SegmentedControl,
} from "@mantine/core";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { EditorPage, ErrorNotice } from "../ui";
import { FormInput, FormField, FormTemplate, Answers } from "../../lib/forms";
import { Fields } from "./Fields";
const kinds = [
  ["text", "Short text"],
  ["textarea", "Long text"],
  ["email", "Email"],
  ["number", "Number"],
  ["date", "Date"],
  ["select", "Choice"],
  ["checkbox", "Checkbox"],
  ["images", "Photos"],
].map(([value, label]) => ({ value, label }));
export function FormEditor({
  value,
  save,
}: {
  value?: FormTemplate;
  save: (data: FormInput) => Promise<void>;
}) {
  const [name, setName] = useState(value?.name ?? ""),
    [description, setDescription] = useState(value?.description ?? "");
  const [fields, setFields] = useState<FormField[]>(
    value?.definition.fields ?? [
      {
        id: "name",
        kind: "text",
        label: "Your name",
        required: true,
        options: [],
      },
    ],
  );
  const [mode, setMode] = useState("Build"),
    [preview, setPreview] = useState<Answers>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const patch = (i: number, p: Partial<FormField>) =>
    setFields((old) => old.map((f, n) => (n === i ? { ...f, ...p } : f)));
  function move(i: number, d: number) {
    setFields((old) => {
      const a = [...old];
      [a[i], a[i + d]] = [a[i + d], a[i]];
      return a;
    });
  }
  return (
    <EditorPage title={value ? "Edit form" : "Create form"}>
      <Stack>
        <TextInput
          label="Form name"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          maxLength={100}
        />
        <Textarea
          label="When should the agent offer this form?"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          maxLength={1000}
        />
        <SegmentedControl
          value={mode}
          onChange={setMode}
          data={["Build", "Preview"]}
        />
        {mode === "Preview" ? (
          <Fields
            fields={fields}
            answers={preview}
            change={(id, v) => setPreview((p) => ({ ...p, [id]: v }))}
          />
        ) : (
          <Stack>
            {fields.map((f, i) => (
              <Paper withBorder p="md" key={f.id}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Field {i + 1}
                    </Text>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        aria-label={`Move field ${i + 1} up`}
                        disabled={!i}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        aria-label={`Move field ${i + 1} down`}
                        disabled={i === fields.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Remove field ${i + 1}`}
                        disabled={fields.length === 1}
                        onClick={() =>
                          setFields((a) => a.filter((_, n) => n !== i))
                        }
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  <TextInput
                    label={`Field ${i + 1} label`}
                    value={f.label}
                    maxLength={150}
                    required
                    onChange={(e) => patch(i, { label: e.currentTarget.value })}
                  />
                  <Select
                    label={`Field ${i + 1} type`}
                    data={kinds}
                    value={f.kind ?? "text"}
                    onChange={(v) => patch(i, { kind: v as FormField["kind"] })}
                  />
                  {f.kind === "select" && (
                    <Textarea
                      label="Choices (one per line)"
                      value={(f.options ?? []).join("\n")}
                      onChange={(e) =>
                        patch(i, { options: e.currentTarget.value.split("\n") })
                      }
                    />
                  )}
                  <Checkbox
                    label="Required"
                    checked={f.required ?? false}
                    onChange={(e) =>
                      patch(i, { required: e.currentTarget.checked })
                    }
                  />
                </Stack>
              </Paper>
            ))}
            <Button
              variant="light"
              leftSection={<Plus size={16} />}
              disabled={fields.length >= 30}
              onClick={() =>
                setFields((a) => [
                  ...a,
                  {
                    id:
                      "f_" +
                      crypto.randomUUID().replaceAll("-", "").slice(0, 12),
                    label: "New field",
                    kind: "text",
                    required: false,
                    options: [],
                  },
                ])
              }
            >
              Add field
            </Button>
          </Stack>
        )}
        <ErrorNotice error={error} />
        <Button
          loading={busy}
          disabled={!name.trim() || fields.some((f) => !f.label.trim())}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await save({
                name,
                description,
                definition: {
                  schema_version: 1,
                  fields: fields.map((f) => ({
                    ...f,
                    options: (f.options ?? [])
                      .map((o) => o.trim())
                      .filter(Boolean),
                  })),
                },
                version: value?.version ?? 1,
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save form
        </Button>
      </Stack>
    </EditorPage>
  );
}
