"use client";
import {
  readRouteValues,
  useRouteState,
  updateRoute,
} from "../../hooks/useRouteState";
import { PublicConversation } from "../../components/sharing/PublicConversation";
import { useState, useEffect } from "react";
import { Session } from "../../lib/api";
import {
  WidgetLanguageContext,
  WidgetBrandContext,
  WidgetLanguage,
} from "../../components/WidgetLanguage";
import { Chat } from "../../components/Chat";
export default function Widget() {
  const [language, setLanguage] = useState<WidgetLanguage>("en");
  const [publication] = useRouteState("agent");
  const [standalone, setStandalone] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    const locale =
      new URLSearchParams(location.search).get("language") === "de"
        ? "de"
        : "en";
    setLanguage(locale);
    document.documentElement.lang = locale;
    document.title = locale === "de" ? "KI-Assistent" : "AI assistant";
    setStandalone(window.parent === window);
    const receive = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const s = e.data?.type === "elma:session" ? e.data.session : null;
      if (
        s &&
        typeof s.token === "string" &&
        typeof s.id === "string" &&
        typeof s.url === "string"
      ) {
        setSession(s as Session);
        if (
          s.widget_context?.language === "de" ||
          s.widget_context?.language === "en"
        ) {
          setLanguage(s.widget_context.language);
          document.documentElement.lang = s.widget_context.language;
        }
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
    <WidgetLanguageContext.Provider value={language}>
      <WidgetBrandContext.Provider value={!!session.widget_context?.brand_name}>
        <Chat
          inline
          session={session}
          onClose={() => {
            setSession(null);
            window.parent.postMessage({ type: "elma:close" }, "*");
          }}
        />
      </WidgetBrandContext.Provider>
    </WidgetLanguageContext.Provider>
  ) : (
    <div className="widget-wait">
      {language === "de"
        ? "Verbindung zum Assistenten wird hergestellt…"
        : "Connecting to your agent…"}
    </div>
  );
}
