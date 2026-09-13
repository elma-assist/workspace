"use client";
import { useCallback, useSyncExternalStore } from "react";

const event = "elma:route";
const adminKeys = new Set([
  "create-organization",
  "agent-editor",
  "publish-agent",
  "knowledge-base",
  "create-knowledge",
  "add-document",
  "form-editor",
  "invite-teammate",
  "member-access",
  "request",
  "history",
  "delete-admin-request",
  "delete-conversation",
  "conversation",
  "chat-agent",
  "share-conversation",
  "requests-panel",
  "active-request",
  "delete-request",
  "photo",
]);
type RouteValues = Record<string, string | null>;

function subscribe(update: () => void) {
  window.addEventListener("popstate", update);
  window.addEventListener(event, update);
  return () => {
    window.removeEventListener("popstate", update);
    window.removeEventListener(event, update);
  };
}
export function useRoutePath(fallback: string) {
  return useSyncExternalStore(
    subscribe,
    () => location.pathname,
    () => fallback,
  );
}
const decode = (value = "") => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const encode = (value: string) => encodeURIComponent(value);

function parseConversationTail(parts: string[], values: RouteValues) {
  let index = 0;
  if (parts[index] === "requests") {
    values["requests-panel"] = "open";
    values["active-request"] = decode(parts[index + 1] || "list");
    index += 2;
  }
  if (parts[index] === "delete") {
    values["delete-request"] = decode(parts[index + 1]);
    index += 2;
  }
  if (parts[index] === "share") {
    values["share-conversation"] = "open";
    index += 1;
  }
  if (parts[index] === "photos") values.photo = decode(parts[index + 1]);
}

function parseAdmin(pathname: string): RouteValues {
  const parts = pathname.split("/").filter(Boolean);
  const values: RouteValues = {};
  if (parts[0] !== "app") return values;
  if (parts[1] === "new") {
    values["create-organization"] = "open";
    return values;
  }
  const section = parts[2];
  const rest = parts.slice(3);
  if (section === "agents") {
    if (rest[0] === "new") values["agent-editor"] = "new";
    else if (rest[1] === "edit") values["agent-editor"] = decode(rest[0]);
    else if (rest[1] === "publish") values["publish-agent"] = decode(rest[0]);
    else if (rest[1] === "conversations" && rest[2]) {
      values["chat-agent"] = decode(rest[0]);
      values.conversation = decode(rest[2]);
      parseConversationTail(rest.slice(3), values);
    }
  } else if (section === "knowledge") {
    if (rest[0] === "new") values["create-knowledge"] = "open";
    else if (rest[0]) {
      values["knowledge-base"] = decode(rest[0]);
      if (rest[1] === "add-document") values["add-document"] = "open";
    }
  } else if (section === "forms") {
    if (rest[0] === "new") values["form-editor"] = "new";
    else if (rest[0] && rest[1] === "edit")
      values["form-editor"] = decode(rest[0]);
  } else if (section === "employees") {
    if (rest[0] === "invite") values["invite-teammate"] = "open";
    else if (rest[0] && rest[1] === "access")
      values["member-access"] = decode(rest[0]);
  } else if (section === "requests" && rest[0]) {
    values.request = decode(rest[0]);
    if (rest[1] === "delete") values["delete-admin-request"] = "open";
    else if (rest[1] === "photos") values.photo = decode(rest[2]);
  } else if (section === "conversations" && rest[0]) {
    values.history = decode(rest[0]);
    if (rest[1] === "delete") values["delete-conversation"] = "open";
    else if (rest[1] === "photos") values.photo = decode(rest[2]);
  }
  return values;
}

function parsePublic(pathname: string): RouteValues {
  const parts = pathname.split("/").filter(Boolean);
  const values: RouteValues = {};
  let rest: string[] = [];
  if (parts[0] === "a" && parts[1] && parts[2]) rest = parts.slice(3);
  else if (parts[0] === "s") rest = parts.slice(1);
  else if (parts[0] === "widget") {
    if (parts[1]) values.agent = decode(parts[1]);
    rest = parts.slice(2);
  }
  if (rest[0] === "conversations" && rest[1]) {
    values.conversation = decode(rest[1]);
    parseConversationTail(rest.slice(2), values);
  }
  return values;
}

function conversationTail(values: RouteValues) {
  const parts: string[] = [];
  if (values["requests-panel"] === "open")
    parts.push("requests", encode(values["active-request"] || "list"));
  if (values["delete-request"])
    parts.push("delete", encode(values["delete-request"]));
  if (values["share-conversation"] === "open") parts.push("share");
  if (values.photo) parts.push("photos", encode(values.photo));
  return parts;
}

function buildAdmin(pathname: string, values: RouteValues) {
  const parts = pathname.split("/").filter(Boolean);
  if (values["create-organization"] === "open") return "/app/new";
  const slug = parts[1] === "new" ? "" : decode(parts[1]);
  if (!slug) return "/app";
  const section = parts[2] || "agents";
  const base = `/app/${encode(slug)}/${section}`;
  if (section === "agents") {
    if (values.conversation && values["chat-agent"]) {
      const tail = conversationTail(values);
      return `${base}/${encode(values["chat-agent"])}/conversations/${encode(values.conversation)}${tail.length ? `/${tail.join("/")}` : ""}`;
    }
    if (values["agent-editor"] === "new") return `${base}/new`;
    if (values["agent-editor"])
      return `${base}/${encode(values["agent-editor"])}/edit`;
    if (values["publish-agent"])
      return `${base}/${encode(values["publish-agent"])}/publish`;
  }
  if (section === "knowledge") {
    if (values["create-knowledge"] === "open") return `${base}/new`;
    if (values["knowledge-base"])
      return `${base}/${encode(values["knowledge-base"])}${values["add-document"] === "open" ? "/add-document" : ""}`;
  }
  if (section === "forms" && values["form-editor"])
    return values["form-editor"] === "new"
      ? `${base}/new`
      : `${base}/${encode(values["form-editor"])}/edit`;
  if (section === "employees") {
    if (values["invite-teammate"] === "open") return `${base}/invite`;
    if (values["member-access"])
      return `${base}/${encode(values["member-access"])}/access`;
  }
  if (section === "requests" && values.request)
    return `${base}/${encode(values.request)}${values["delete-admin-request"] === "open" ? "/delete" : values.photo ? `/photos/${encode(values.photo)}` : ""}`;
  if (section === "conversations" && values.history)
    return `${base}/${encode(values.history)}${values["delete-conversation"] === "open" ? "/delete" : values.photo ? `/photos/${encode(values.photo)}` : ""}`;
  return base;
}

function buildPublic(pathname: string, values: RouteValues) {
  const parts = pathname.split("/").filter(Boolean);
  let base: string;
  if (parts[0] === "a" && parts[1] && parts[2])
    base = `/a/${encode(decode(parts[1]))}/${encode(decode(parts[2]))}`;
  else if (parts[0] === "s") base = "/s";
  else {
    const agent = values.agent || decode(parts[1]);
    base = agent ? `/widget/${encode(agent)}` : "/widget";
  }
  if (!values.conversation) return base;
  const tail = conversationTail(values);
  return `${base}/conversations/${encode(values.conversation)}${tail.length ? `/${tail.join("/")}` : ""}`;
}

export function readRouteValues(pathname: string, search = "") {
  if (pathname === "/app" || pathname.startsWith("/app/"))
    return parseAdmin(pathname);
  if (
    pathname === "/s" ||
    pathname.startsWith("/s/") ||
    pathname === "/widget" ||
    pathname.startsWith("/widget/") ||
    pathname.startsWith("/a/")
  )
    return parsePublic(pathname);
  return Object.fromEntries(new URLSearchParams(search));
}

export function updateRoute(values: RouteValues, replace = false) {
  const url = new URL(location.href);
  if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
    url.pathname = buildAdmin(url.pathname, {
      ...parseAdmin(url.pathname),
      ...values,
    });
    for (const key of adminKeys) url.searchParams.delete(key);
  } else if (
    url.pathname === "/s" ||
    url.pathname.startsWith("/s/") ||
    url.pathname === "/widget" ||
    url.pathname.startsWith("/widget/") ||
    url.pathname.startsWith("/a/")
  ) {
    url.pathname = buildPublic(url.pathname, {
      ...parsePublic(url.pathname),
      ...values,
    });
    for (const key of adminKeys) url.searchParams.delete(key);
    url.searchParams.delete("agent");
  } else {
    for (const [key, value] of Object.entries(values)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
  }
  if (url.href === location.href) return;
  history[replace || window.parent !== window ? "replaceState" : "pushState"](
    history.state,
    "",
    url,
  );
  window.dispatchEvent(new Event(event));
}

export function useRouteState(key: string, fallback = "", initialSearch = "") {
  const externalRoute = useSyncExternalStore(
    subscribe,
    () => location.pathname + location.search,
    () => initialSearch,
  );
  const pathname = externalRoute.split("?")[0];
  const pathRouted =
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/s" ||
    pathname.startsWith("/s/") ||
    pathname === "/widget" ||
    pathname.startsWith("/widget/") ||
    pathname.startsWith("/a/");
  const route = externalRoute;
  const value = pathRouted
    ? readRouteValues(pathname)[key] || fallback
    : new URLSearchParams(
        route.includes("?") ? route.split("?")[1] : route,
      ).get(key) || fallback;
  const set = useCallback(
    (
      next: string | null | ((old: string) => string | null),
      replace = false,
    ) => {
      const current =
        readRouteValues(location.pathname, location.search)[key] || fallback;
      updateRoute(
        { [key]: typeof next === "function" ? next(current) : next },
        replace,
      );
    },
    [key, fallback],
  );
  return [value, set] as const;
}

export function useRouteFlag(key: string) {
  const [value, set] = useRouteState(key);
  const change = useCallback(
    (next: boolean | ((old: boolean) => boolean)) => {
      set((old) =>
        (typeof next === "function" ? next(old === "open") : next)
          ? "open"
          : null,
      );
    },
    [set],
  );
  return [value === "open", change] as const;
}
