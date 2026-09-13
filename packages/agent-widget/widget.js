(() => {
  const icons = __ELMA_ICONS__;
  const script = document.currentScript;
  const base = new URL(script.src).origin;
  const publication = script.dataset.agent;
  const style = document.createElement("style");
  style.textContent = __ELMA_WIDGET_CSS__;
  document.head.appendChild(style);
  const button = document.createElement("button");
  button.className = "elma-launcher";
  button.innerHTML = icons["message-square"] + "<span>Talk to your AI</span>";
  button.setAttribute("aria-label", "Open agent widget");
  document.body.appendChild(button);
  let panel,
    frame,
    session,
    pending = false;
  function fit() {
    if (!panel) return;
    const view = window.visualViewport;
    const width = view?.width || innerWidth,
      height = view?.height || innerHeight;
    const margin = width <= 480 ? 8 : 24;
    const panelWidth = Math.min(frame ? 840 : 410, width - margin * 2);
    const panelHeight = Math.min(620, height - margin * 2);
    Object.assign(panel.style, {
      width: panelWidth + "px",
      height: panelHeight + "px",
      left: (view?.offsetLeft || 0) + width - margin - panelWidth + "px",
      top: (view?.offsetTop || 0) + height - margin - panelHeight + "px",
    });
  }
  const routeKeys = [
    "requests-panel",
    "active-request",
    "delete-request",
    "share-conversation",
    "photo",
  ];
  function iframePath(conversation, params) {
    const parts = ["widget", publication, "conversations", conversation];
    if (params.get("elma-requests-panel") === "open")
      parts.push(
        "requests",
        params.get("elma-active-request") || "list",
      );
    if (params.get("elma-delete-request"))
      parts.push("delete", params.get("elma-delete-request"));
    if (params.get("elma-share-conversation") === "open") parts.push("share");
    if (params.get("elma-photo"))
      parts.push("photos", params.get("elma-photo"));
    return "/" + parts.map(encodeURIComponent).join("/");
  }
  function route(values, replace = false) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value == null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    if (url.href !== location.href)
      history[replace ? "replaceState" : "pushState"](history.state, "", url);
  }
  function close(navigate = true) {
    if (navigate)
      route({
        "elma-agent": null,
        "elma-conversation": null,
        ...Object.fromEntries(routeKeys.map((k) => ["elma-" + k, null])),
      });
    panel?.remove();
    panel = frame = session = null;
    pending = false;
    button.style.display = "inline-flex";
    button.focus();
    window.visualViewport?.removeEventListener("resize", fit);
    window.visualViewport?.removeEventListener("scroll", fit);
    window.removeEventListener("resize", fit);
  }
  function visitorToken() {
    try {
      return (
        localStorage.getItem("elma-visitor-" + base + "-" + publication) || ""
      );
    } catch {
      return "";
    }
  }
  function savedConversation() {
    try {
      return (
        localStorage.getItem("elma-conversation-" + base + "-" + publication) ||
        null
      );
    } catch {
      return null;
    }
  }
  async function start(mode) {
    if (pending) return;
    pending = true;
    const activePanel = panel;
    activePanel.querySelector(".elma-status").textContent = "Connecting…";
    activePanel
      .querySelector(`[data-mode="${mode}"]`)
      ?.setAttribute("aria-busy", "true");
    activePanel
      .querySelectorAll("[data-mode]")
      .forEach((b) => (b.disabled = true));
    try {
      const r = await fetch(base + "/api/public/" + publication + "/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Visitor-Token": visitorToken(),
        },
        body: JSON.stringify({
          mode,
          conversation_id:
            new URLSearchParams(location.search).get("elma-conversation") ||
            savedConversation(),
        }),
      });
      if (!r.ok) {
        const error = await r.json();
        throw new Error(error.detail || "Unable to connect");
      }
      const nextSession = await r.json();
      if (panel !== activePanel) return;
      session = nextSession;
      try {
        localStorage.setItem(
          "elma-conversation-" + base + "-" + publication,
          session.id,
        );
        localStorage.setItem(
          "elma-visitor-" + base + "-" + publication,
          session.visitor_token || "",
        );
      } catch {}
      frame = document.createElement("iframe");
      route({ "elma-conversation": session.id });
      const params = new URLSearchParams(location.search);
      frame.src = new URL(iframePath(session.id, params), base).href;
      frame.title = "AI agent conversation";
      frame.allow = "microphone; autoplay";
      panel.replaceChildren(frame);
      fit();
    } catch (e) {
      if (panel === activePanel)
        panel.querySelector(".elma-status").textContent = e.message;
    } finally {
      if (panel === activePanel) {
        pending = false;
        panel.querySelectorAll("[data-mode]").forEach((b) => {
          b.disabled = false;
          b.removeAttribute("aria-busy");
        });
      }
    }
  }
  function open(navigate = true) {
    if (panel) return;
    if (navigate) route({ "elma-agent": publication });
    button.style.display = "none";
    panel = document.createElement("section");
    panel.className = "elma-panel";
    panel.setAttribute("aria-label", "AI agent widget");
    panel.innerHTML = `<div class="elma-intro"><button class="elma-close" aria-label="Close">${icons.x}</button><div class="elma-eyebrow">YOUR AI ASSISTANT</div><h2>A conversation<br>away.</h2><p>Ask a question in English or German.<br>Type it. Or say it.</p><div class="elma-start"><button data-mode="text">${icons["message-square"]} Start a chat</button><button data-mode="voice">${icons.mic} Start a voice conversation</button></div><p class="elma-status" role="status">You’re speaking with an AI. Please avoid sharing sensitive information.</p></div>`;
    panel.querySelector('[aria-label="Close"]').onclick = () => close();
    panel
      .querySelectorAll("[data-mode]")
      .forEach((b) => (b.onclick = () => start(b.dataset.mode)));
    document.body.appendChild(panel);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    fit();
    panel.querySelector('[aria-label="Close"]').focus();
  }
  button.onclick = () => open();
  window.addEventListener("message", (e) => {
    if (e.origin !== base || e.source !== frame?.contentWindow) return;
    if (e.data?.type === "elma:ready" && session)
      frame.contentWindow.postMessage({ type: "elma:session", session }, base);
    if (e.data?.type === "elma:close") close();
    if (e.data?.type === "elma:route" && typeof e.data.search === "string") {
      const params = new URLSearchParams(e.data.search);
      route(
        Object.fromEntries(routeKeys.map((k) => ["elma-" + k, params.get(k)])),
      );
    }
  });
  function restore() {
    const params = new URLSearchParams(location.search);
    if (params.get("elma-agent") !== publication) {
      close(false);
      return;
    }
    const cid = params.get("elma-conversation");
    if (session && cid !== session.id) close(false);
    open(false);
    if (cid && !session && !pending) void start("text");
    if (frame && session) {
      const search = new URLSearchParams();
      for (const key of routeKeys)
        if (params.get("elma-" + key))
          search.set(key, params.get("elma-" + key));
      frame.contentWindow.postMessage(
        { type: "elma:route", search: search.toString() },
        base,
      );
    }
  }
  window.addEventListener("popstate", restore);
  window.addEventListener("elma:open", () => open());
  restore();
})();
