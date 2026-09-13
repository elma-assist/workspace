import type { components } from "../../../packages/contracts/api";
import type { Session } from "./api";
export type FormTemplate = components["schemas"]["FormTemplate"];
export type FormInput = components["schemas"]["FormInput"];
export type FormField = components["schemas"]["FormField"];
export type RequestRecord = components["schemas"]["RequestRecord"];
export type Attachment = components["schemas"]["Attachment"];
export type Answer = string | number | boolean;
export type Answers = Record<string, Answer>;
export const statusNames: Record<RequestRecord["status"], string> = {
  draft: "Draft",
  submitted: "New",
  in_progress: "In progress",
  waiting: "Waiting for customer",
  closed: "Closed",
};
export function requestBase(session: Session) {
  return `/api/public/conversations/${session.id}`;
}
export function guestHeaders(session: Session): Record<string, string> {
  return session.guest_token ? { "X-Guest-Token": session.guest_token } : {};
}
export class FormRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function formFetch<T>(
  url: string,
  session?: Session,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const multipart = data instanceof FormData;
  const r = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      ...(!multipart ? { "Content-Type": "application/json" } : {}),
      ...(session ? guestHeaders(session) : {}),
    },
    body:
      data === undefined ? undefined : multipart ? data : JSON.stringify(data),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: "Service unavailable" }));
    throw new FormRequestError(
      typeof e.detail === "string" ? e.detail : "Check the form fields",
      r.status,
    );
  }
  return r.json();
}
