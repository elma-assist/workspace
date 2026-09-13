"use client";
import {
  readRouteValues,
  useRouteState,
  updateRoute,
} from "../../hooks/useRouteState";
import { PublicConversation } from "../../components/sharing/PublicConversation";
import { useState, useEffect } from "react";
import { Session } from "../../lib/api";
import { Chat } from "../../components/Chat";
export default function Widget() {
  const [publication] = useRouteState("agent");
  const [standalone, setStandalone] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setStandalone(window.parent === window);
    const receive = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const s = e.data.session;
      if (
        s &&
        typeof s.token === "string" &&
        typeof s.id === "string" &&
        typeof s.url === "string"
      ) {
        setSession(s as Session);
        const agent = readRouteValues(location.pathname, location.search).agent;
        if (agent && s.visitor_token) {
          try {
            const prefix = location.origin + "-" + agent;
            localStorage.setItem("elma-visitor-" + prefix, s.visitor_token);
            localStorage.setItem("elma-conversation-" + prefix, s.id);
          } catch {}
        }
      }
      if (e.data?.type === "elma:route" && typeof e.data.search === "string") {
        const params = new URLSearchParams(e.data.search);
        updateRoute(
          Object.fromEntries(
            [
              "requests-panel",
              "active-request",
              "delete-request",
              "share-conversation",
              "photo",
            ].map((k) => [k, params.get(k)]),
          ),
          true,
        );
      }
    };
    const changed = () => {
      const values = readRouteValues(location.pathname, location.search);
      const search = new URLSearchParams();
      for (const key of [
        "requests-panel",
        "active-request",
        "delete-request",
        "share-conversation",
        "photo",
      ]) {
        if (values[key]) search.set(key, values[key]!);
      }
      window.parent.postMessage(
        { type: "elma:route", search: search.toString() },
        "*",
      );
    };
    window.addEventListener("popstate", changed);
    window.addEventListener("elma:route", changed);
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "elma:ready" }, "*");
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("popstate", changed);
      window.removeEventListener("elma:route", changed);
    };
  }, []);
  if (standalone)
    return publication ? (
      <PublicConversation widgetId={publication} />
    ) : (
      <p>This widget link is incomplete.</p>
    );
  return session ? (
    <Chat
      inline
      session={session}
      onClose={() => {
        setSession(null);
        window.parent.postMessage({ type: "elma:close" }, "*");
      }}
    />
  ) : (
    <div className="widget-wait">Connecting to your agent…</div>
  );
}
