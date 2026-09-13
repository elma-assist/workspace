"use client";
import { Button } from "./AsyncAction";
import { useState, useEffect } from "react";
import {
  Stack,
  TextInput,
  Textarea,
  NativeSelect,
  Checkbox,
  Text,
} from "@mantine/core";
import { api, Agent, Organization, Knowledge } from "../lib/api";
import { FormTemplate } from "../lib/forms";
import {
  DEFAULT_CARTESIA_VOICE,
  STT_MODELS,
  TTS_MODELS,
  VOICES,
} from "../lib/agentModels";
import { EditorPage, ErrorNotice } from "./ui";
export function AgentEditor({
  value,
  org,
  bases,
  done,
}: {
  value: Partial<Agent>;
  org: Organization;
  bases: Knowledge[];
  done: () => void;
}) {
  const [selected, setSelected] = useState(value.kb_ids || []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [forms, setForms] = useState<FormTemplate[]>([]),
    [formIds, setFormIds] = useState(value.form_ids || []);
  const initial = value.config!;
  const [language, setLanguage] = useState(initial.language);
  const [sttProvider, setSttProvider] = useState(initial.stt_provider);
  const [sttModel, setSttModel] = useState(initial.stt);
  const [ttsProvider, setTtsProvider] = useState(initial.tts_provider);
  const [ttsModel, setTtsModel] = useState(initial.tts);
  const [voice, setVoice] = useState(initial.voice);
  useEffect(() => {
    api<FormTemplate[]>(`/organizations/${org.id}/forms`)
      .then(setForms)
      .catch((e) => setError(e.message));
  }, [org.id]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(
        `/organizations/${org.id}/agents${value.id ? "/" + value.id : ""}`,
        value.id ? "PUT" : "POST",
        {
          name: f.get("name"),
          description: f.get("description"),
          instruction: f.get("instruction"),
          kb_ids: selected,
          form_ids: formIds,
          config: {
            ...value.config,
            language,
            llm: f.get("model"),
            stt_provider: sttProvider,
            stt: sttModel,
            tts_provider: ttsProvider,
            tts: ttsModel,
            voice,
          },
        },
      );
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <EditorPage title={value.id ? "Edit agent" : "Create agent"}>
      <form onSubmit={save}>
        <Stack gap="md">
          <TextInput
            name="name"
            defaultValue={value.name}
            placeholder="e.g. Emma"
            required
            label="Agent name"
          />
          <TextInput
            name="description"
            defaultValue={value.description ?? ""}
            maxLength={180}
            label="Short description"
            description="Shown below the agent’s name in chat. Up to 180 characters."
            placeholder="How does this agent help?"
          />
          {value.slug && (
            <TextInput
              label="Agent slug"
              value={value.slug}
              readOnly
              description="Used in public links. Renaming the agent keeps this address."
            />
          )}
          <Textarea
            name="instruction"
            defaultValue={value.instruction}
            rows={5}
            placeholder="What should this agent help your team with?"
            required
            label="Role & instructions"
          />
          <Text fw={600}>Language and reasoning</Text>
          <div className="two-col">
            <NativeSelect
              name="language"
              value={language}
              onChange={(event) =>
                setLanguage(event.currentTarget.value as typeof language)
              }
              label="Response language"
              description="Automatic follows the customer’s supported language."
            >
              <option value="auto">Automatic</option>
              <option value="English">English</option>
              <option value="German">Deutsch</option>
              <option value="Russian" disabled={ttsProvider === "mistral"}>
                Русский
              </option>
            </NativeSelect>
            <NativeSelect
              name="model"
              defaultValue={value.config?.llm}
              label="Model"
            >
              <option value="mistral-small-latest">Mistral Small</option>
              <option value="mistral-large-latest">Mistral Large</option>
            </NativeSelect>
          </div>
          <Text fw={600}>Speech recognition</Text>
          <div className="two-col">
            <NativeSelect
              label="Provider"
              value={sttProvider}
              onChange={(event) => {
                const provider = event.currentTarget
                  .value as typeof sttProvider;
                setSttProvider(provider);
                setSttModel(STT_MODELS[provider][0].value);
              }}
            >
              <option value="deepgram">Deepgram</option>
              <option value="mistral">Mistral AI</option>
            </NativeSelect>
            <NativeSelect
              label="Model"
              value={sttModel}
              onChange={(event) =>
                setSttModel(event.currentTarget.value as typeof sttModel)
              }
            >
              {STT_MODELS[sttProvider].map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Text fw={600}>Voice</Text>
          <div className="two-col">
            <NativeSelect
              label="Provider"
              value={ttsProvider}
              onChange={(event) => {
                const provider = event.currentTarget
                  .value as typeof ttsProvider;
                setTtsProvider(provider);
                setTtsModel(TTS_MODELS[provider][0].value);
                setVoice(
                  provider === "cartesia"
                    ? DEFAULT_CARTESIA_VOICE
                    : VOICES.mistral[0].value,
                );
                if (provider === "mistral" && language === "Russian") {
                  setLanguage("auto");
                }
              }}
            >
              <option value="cartesia">Cartesia</option>
              <option value="mistral">Mistral AI</option>
            </NativeSelect>
            <NativeSelect
              label="Model"
              value={ttsModel}
              onChange={(event) =>
                setTtsModel(event.currentTarget.value as typeof ttsModel)
              }
            >
              {TTS_MODELS[ttsProvider].map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <NativeSelect
            label="Voice"
            value={voice}
            onChange={(event) => setVoice(event.currentTarget.value)}
          >
            {VOICES[ttsProvider].map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
          <label>Knowledge bases</label>
          <div className="check-list">
            {bases.map((b) => (
              <Checkbox
                key={b.id}
                checked={selected.includes(b.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, b.id]
                      : selected.filter((id) => id !== b.id),
                  )
                }
                label={
                  <>
                    {b.name}
                    <small>{b.ready} ready</small>
                  </>
                }
              />
            ))}
            {!bases.length && (
              <p className="muted">
                You can connect knowledge after uploading documents.
              </p>
            )}
          </div>
          <label>Available forms</label>
          {forms.map((f) => (
            <Checkbox
              key={f.id}
              label={f.name}
              checked={formIds.includes(f.id)}
              onChange={(e) =>
                setFormIds(
                  e.currentTarget.checked
                    ? [...formIds, f.id]
                    : formIds.filter((id) => id !== f.id),
                )
              }
            />
          ))}
          {!forms.length && (
            <p className="muted">Create forms in the Forms section first.</p>
          )}
          <ErrorNotice error={error} />
          <Button loading={busy} type="submit" variant="filled" fullWidth>
            Save agent
          </Button>
        </Stack>
      </form>
    </EditorPage>
  );
}
