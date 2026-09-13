"use client";
import {
  TextInput,
  Textarea,
  NumberInput,
  Select,
  Checkbox,
  Stack,
  Text,
} from "@mantine/core";
import { CheckCircle2 } from "lucide-react";
import { FormField, Answers, Answer } from "../../lib/forms";
export function Fields({
  fields,
  answers,
  change,
  readOnly = false,
  images,
  saved,
  hasImages,
  saving = false,
  saveError = false,
  blur,
}: {
  fields: FormField[];
  answers: Answers;
  saved?: Answers;
  saving?: boolean;
  saveError?: boolean;
  blur?: () => void;
  hasImages?: (id: string) => boolean;
  change: (id: string, value: Answer) => void;
  readOnly?: boolean;
  images?: (f: FormField) => React.ReactNode;
}) {
  return (
    <Stack gap="md">
      {fields.map((f) => {
        const value = answers[f.id];
        const common = {
          label: f.label,
          required: f.required,
          disabled: readOnly,
          onBlur: blur,
        };
        let input;
        switch (f.kind) {
          case "images":
            input = images ? (
              images(f)
            ) : (
              <Text size="sm">{f.label} · Photo upload</Text>
            );
            break;
          case "checkbox":
            input = (
              <Checkbox
                {...common}
                checked={value === true}
                onChange={(e) => change(f.id, e.currentTarget.checked)}
              />
            );
            break;
          case "textarea":
            input = (
              <Textarea
                {...common}
                autosize
                minRows={3}
                maxRows={6}
                maxLength={4000}
                value={String(value ?? "")}
                onChange={(e) => change(f.id, e.currentTarget.value)}
              />
            );
            break;
          case "number":
            input = (
              <NumberInput
                {...common}
                value={typeof value === "number" ? value : ""}
                onChange={(v) => change(f.id, v)}
              />
            );
            break;
          case "select":
            input = (
              <Select
                {...common}
                data={f.options ?? []}
                value={typeof value === "string" ? value : null}
                onChange={(v) => change(f.id, v ?? "")}
                clearable
              />
            );
            break;
          default:
            input = (
              <TextInput
                {...common}
                type={
                  f.kind === "email"
                    ? "email"
                    : f.kind === "date"
                      ? "date"
                      : "text"
                }
                maxLength={4000}
                value={String(value ?? "")}
                onChange={(e) => change(f.id, e.currentTarget.value)}
              />
            );
        }
        const populated =
          f.kind === "images"
            ? !!hasImages?.(f.id)
            : value !== undefined &&
              (typeof value !== "string" || value.trim() !== "") &&
              (f.kind !== "checkbox" || !f.required || value === true);
        const complete =
          populated && (f.kind === "images" || saved?.[f.id] === value);
        const modified = saved && f.kind !== "images" && value !== saved[f.id];
        return (
          <div key={f.id}>
            {input}
            {saved && (
              <div className="field-save-state" aria-live="polite">
                {complete ? (
                  <>
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>Saved</span>
                  </>
                ) : modified ? (
                  <span className="field-unsaved">
                    {saveError
                      ? "Not saved — please retry"
                      : saving
                        ? "Saving…"
                        : "Waiting to save…"}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </Stack>
  );
}
