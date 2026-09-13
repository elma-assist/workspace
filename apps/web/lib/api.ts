import type { components } from "../../../packages/contracts/api";
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response
      .json()
      .catch(() => ({ detail: "Service is unavailable" }));
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Please check the form fields",
    );
  }
  return response.json() as Promise<T>;
}
export type User = components["schemas"]["User"];
export type Organization = components["schemas"]["Organization"];
export type AgentConfig = components["schemas"]["AgentConfig"];
export type Agent = components["schemas"]["Agent"];
export type Knowledge = components["schemas"]["KnowledgeBase"];
export type Document = components["schemas"]["Document"];
export type Session = components["schemas"]["Session"];
export type Source = components["schemas"]["Source"];
export type History = components["schemas"]["History"];
export type Detail = components["schemas"]["Detail"];
export type Message = Pick<
  components["schemas"]["Message"],
  "id" | "role" | "content"
>;
export const defaultConfig: AgentConfig = {
  schema_version: 1,
  llm: "mistral-small-latest",
  stt_provider: "deepgram",
  stt: "flux-general-multi",
  tts_provider: "cartesia",
  tts: "sonic-3.6",
  voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
  language: "auto",
};
