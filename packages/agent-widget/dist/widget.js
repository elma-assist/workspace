(() => {
  const icons = {"arrow-up-right":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-arrow-up-right\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M7 7h10v10\"></path><path d=\"M7 17 17 7\"></path></svg>","arrow-right":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-arrow-right\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M5 12h14\"></path><path d=\"m12 5 7 7-7 7\"></path></svg>","sparkles":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-sparkles\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\"></path><path d=\"M20 3v4\"></path><path d=\"M22 5h-4\"></path><path d=\"M4 17v2\"></path><path d=\"M5 18H3\"></path></svg>","x":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg>","mic":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-mic\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z\"></path><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\"></path><line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\"></line></svg>","message-square":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-message-square\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"></path></svg>","quote":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-quote\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\"></path><path d=\"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\"></path></svg>","file-text":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-file-text\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"></path><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"></path><path d=\"M10 9H8\"></path><path d=\"M16 13H8\"></path><path d=\"M16 17H8\"></path></svg>","check":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-check\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20 6 9 17l-5-5\"></path></svg>","clipboard-list":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-clipboard-list\" aria-hidden=\"true\" focusable=\"false\"><rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"></rect><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"></path><path d=\"M12 11h4\"></path><path d=\"M12 16h4\"></path><path d=\"M8 11h.01\"></path><path d=\"M8 16h.01\"></path></svg>","image":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-image\" aria-hidden=\"true\" focusable=\"false\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"></rect><circle cx=\"9\" cy=\"9\" r=\"2\"></circle><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"></path></svg>","clipboard-check":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-clipboard-check\" aria-hidden=\"true\" focusable=\"false\"><rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"></rect><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"></path><path d=\"m9 14 2 2 4-4\"></path></svg>","phone":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-phone\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z\"></path></svg>","qr-code":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-qr-code\" aria-hidden=\"true\" focusable=\"false\"><rect width=\"5\" height=\"5\" x=\"3\" y=\"3\" rx=\"1\"></rect><rect width=\"5\" height=\"5\" x=\"16\" y=\"3\" rx=\"1\"></rect><rect width=\"5\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"></rect><path d=\"M21 16h-3a2 2 0 0 0-2 2v3\"></path><path d=\"M21 21v.01\"></path><path d=\"M12 7v3a2 2 0 0 1-2 2H7\"></path><path d=\"M3 12h.01\"></path><path d=\"M12 3h.01\"></path><path d=\"M12 16v.01\"></path><path d=\"M16 12h1\"></path><path d=\"M21 12v.01\"></path><path d=\"M12 21v-1\"></path></svg>","book-open":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-book-open\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 7v14\"></path><path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\"></path></svg>","audio-lines":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-audio-lines\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M2 10v3\"></path><path d=\"M6 6v11\"></path><path d=\"M10 3v18\"></path><path d=\"M14 8v7\"></path><path d=\"M18 5v13\"></path><path d=\"M22 10v3\"></path></svg>","panel-top":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-panel-top\" aria-hidden=\"true\" focusable=\"false\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"></rect><path d=\"M3 9h18\"></path></svg>","chart-no-axes-combined":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-chart-no-axes-combined\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 16v5\"></path><path d=\"M16 14v7\"></path><path d=\"M20 10v11\"></path><path d=\"m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15\"></path><path d=\"M4 18v3\"></path><path d=\"M8 14v7\"></path></svg>","users":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-users\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"></path><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"></path></svg>","pause":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-pause\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\"></rect><rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\"></rect></svg>","play":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-play\" aria-hidden=\"true\" focusable=\"false\"><polygon points=\"6 3 20 12 6 21 6 3\"></polygon></svg>","rotate-ccw":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-rotate-ccw\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"></path><path d=\"M3 3v5h5\"></path></svg>"};
  const script = document.currentScript;
  const language = script.lang === "de" ? "de" : "en";
  const labels =
    language === "de"
      ? {
          launcher: "Mit elma sprechen",
          open: "elma-Widget öffnen",
          close: "Schließen",
          widget: "elma KI-Assistent",
          eyebrow: "DEIN KI-ASSISTENT",
          heading: "Ein Gespräch<br>entfernt.",
          intro:
            "Stelle eine Frage auf Deutsch oder Englisch.<br>Schreib sie. Oder sprich sie aus.",
          chat: "Chat starten",
          voice: "Sprachgespräch starten",
          notice:
            "Du sprichst mit einer KI. Bitte teile keine sensiblen Informationen.",
          connecting: "Verbindung wird hergestellt…",
          error: "Verbindung nicht möglich",
          conversation: "Gespräch mit dem KI-Assistenten",
        }
      : {
          launcher: "Talk to your AI",
          open: "Open agent widget",
          close: "Close",
          widget: "AI agent widget",
          eyebrow: "YOUR AI ASSISTANT",
          heading: "A conversation<br>away.",
          intro: "Ask a question in English or German.<br>Type it. Or say it.",
          chat: "Start a chat",
          voice: "Start a voice conversation",
          notice:
            "You’re speaking with an AI. Please avoid sharing sensitive information.",
          connecting: "Connecting…",
          error: "Unable to connect",
          conversation: "AI agent conversation",
        };
  const brandName = (script.dataset.brandName || "").trim().slice(0, 120);
  const assistantName = (script.dataset.assistantName || brandName)
    .trim()
    .slice(0, 120);
  const launcherLabel = (script.dataset.launcherLabel || "")
    .trim()
    .slice(0, 120);
  const demo = script.dataset.demo === "true";
  const scenarios = ["damage", "management_question", "management_inquiry"];
  let scenario = null,
    fresh = false;
  const escape = (text) =>
    text.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  if (brandName)
    Object.assign(
      labels,
      language === "de"
        ? {
            launcher: "Anliegen mitteilen",
            open: "Service öffnen",
            widget: assistantName,
            eyebrow: brandName,
            heading: "Wie können wir Ihnen helfen?",
            intro:
              "Teilen Sie uns Ihr Anliegen schriftlich oder per Sprache mit.",
            notice:
              "Sie sprechen mit einem digitalen KI-Assistenten. Bitte teilen Sie keine sensiblen Informationen.",
          }
        : {
            launcher: "Tell us your concern",
            open: "Open service",
            widget: assistantName,
            eyebrow: brandName,
            heading: "How can we help you?",
            intro: "Tell us your concern in writing or by voice.",
            notice:
              "You are speaking with a digital AI assistant. Please avoid sharing sensitive information.",
          },
    );
  if (demo)
    labels.notice +=
      language === "de"
        ? " Konzeptdemo: keine bestätigte Übermittlung an das Unternehmen."
        : " Concept demo: no confirmed delivery to the company.";
  if (launcherLabel) labels.launcher = launcherLabel;
  const base = new URL(script.src).origin;
  const publication = script.dataset.agent;
  const style = document.createElement("style");
  style.textContent = ".elma-launcher,\n.elma-panel,\n.elma-panel * {\n  box-sizing: border-box;\n}\n.elma-launcher,\n.elma-panel button {\n  font: 500 14px system-ui;\n  cursor: pointer;\n}\n.elma-launcher {\n  position: fixed;\n  bottom: max(20px, env(safe-area-inset-bottom));\n  right: 20px;\n  display: inline-flex;\n  align-items: center;\n  gap: 10px;\n  border: 0;\n  border-radius: 30px;\n  outline: 3px solid #738b57;\n  outline-offset: 3px;\n  padding: 16px 22px;\n  background: #233e30;\n  color: #f5f9ed;\n  box-shadow: 0 8px 30px #12271d33;\n  z-index: 99999;\n}\n.elma-panel {\n  position: fixed;\n  background: #f8faf3;\n  border: 1px solid #dce5d3;\n  border-radius: 18px;\n  box-shadow: 0 20px 80px #17291e33;\n  z-index: 100000;\n  overflow: hidden;\n  font-family: system-ui;\n  color: #293d29;\n}\n.elma-panel svg,\n.elma-launcher svg {\n  display: block;\n  flex-shrink: 0;\n}\n.elma-panel iframe {\n  display: block;\n  width: 100%;\n  height: 100%;\n  border: 0;\n}\n.elma-intro {\n  height: 100%;\n  overflow: auto;\n  padding: 24px;\n}\n.elma-close {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  margin-left: auto;\n  width: 44px;\n  height: 44px;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: inherit;\n}\n.elma-eyebrow {\n  margin-top: 24px;\n  color: #77886a;\n  font-size: 11px;\n  letter-spacing: 2px;\n}\n.elma-intro h2 {\n  font-size: 32px;\n  font-weight: 500;\n  line-height: 1.2;\n  margin: 16px 0;\n}\n.elma-intro p {\n  color: #617454;\n  font-size: 14px;\n  line-height: 1.7;\n}\n.elma-start {\n  display: grid;\n  gap: 12px;\n  margin-top: 28px;\n}\n.elma-start button {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 10px;\n  min-height: 48px;\n  padding: 12px;\n  border: 0;\n  border-radius: 10px;\n  background: #264332;\n  color: white;\n}\n.elma-start button[data-mode=\"voice\"] {\n  background: #e4eedb;\n  color: #264332;\n}\n.elma-start button:disabled {\n  opacity: 0.65;\n  cursor: wait;\n}\n.elma-intro .elma-status {\n  font-size: 12px;\n  margin-top: 24px;\n  overflow-wrap: anywhere;\n}\n.elma-panel button:focus-visible,\n.elma-launcher:focus-visible {\n  outline: 3px solid #738b57;\n  outline-offset: 3px;\n}\n.elma-launcher:focus-visible {\n  outline-offset: 6px;\n}\n@media (max-height: 480px) {\n  .elma-eyebrow {\n    margin-top: 0;\n  }\n  .elma-start {\n    margin-top: 16px;\n  }\n}\n@media (max-width: 480px) {\n  .elma-launcher {\n    width: 56px;\n    height: 56px;\n    padding: 16px;\n    justify-content: center;\n  }\n  .elma-launcher span {\n    display: none;\n  }\n}\n\n.elma-panel button[aria-busy=\"true\"] {\n  position: relative;\n  color: transparent;\n}\n.elma-panel button[aria-busy=\"true\"] > * {\n  visibility: hidden;\n}\n.elma-panel button[aria-busy=\"true\"]::after {\n  content: \"\";\n  position: absolute;\n  width: 18px;\n  height: 18px;\n  left: calc(50% - 9px);\n  top: calc(50% - 9px);\n  border: 2px solid #adb5bd;\n  border-top-color: #228be6;\n  border-radius: 50%;\n  animation: elma-loading 0.7s linear infinite;\n}\n@keyframes elma-loading {\n  to {\n    transform: rotate(360deg);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .elma-panel button[aria-busy=\"true\"]::after {\n    animation-duration: 2s;\n  }\n}\n";
  document.head.appendChild(style);
  const button = document.createElement("button");
  button.className = "elma-launcher";
  button.lang = language;
  button.innerHTML =
    icons["message-square"] + "<span>" + escape(labels.launcher) + "</span>";
  button.setAttribute("aria-label", labels.open);
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
      parts.push("requests", params.get("elma-active-request") || "list");
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
        "elma-scenario": null,
        ...Object.fromEntries(routeKeys.map((k) => ["elma-" + k, null])),
      });
    panel?.remove();
    panel = frame = session = null;
    pending = false;
    fresh = false;
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
    activePanel.querySelector(".elma-status").textContent = labels.connecting;
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
          new_conversation: fresh,
          widget_context: {
            brand_name: brandName,
            assistant_name: assistantName,
            language,
            scenario,
            demo,
          },
          conversation_id: fresh
            ? null
            : new URLSearchParams(location.search).get("elma-conversation") ||
              savedConversation(),
        }),
      });
      if (!r.ok) {
        const error = await r.json();
        throw new Error(error.detail || labels.error);
      }
      const nextSession = await r.json();
      if (panel !== activePanel) return;
      session = nextSession;
      fresh = false;
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
      const frameUrl = new URL(iframePath(session.id, params), base);
      frameUrl.searchParams.set("language", language);
      frame.src = frameUrl.href;
      frame.title = labels.conversation;
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
    panel.lang = language;
    panel.setAttribute("aria-label", labels.widget);
    panel.innerHTML = `<div class="elma-intro"><button class="elma-close" aria-label="${labels.close}">${icons.x}</button><div class="elma-eyebrow">${escape(labels.eyebrow)}</div><h2>${brandName ? escape(labels.heading) : labels.heading}</h2><p>${labels.intro}</p><div class="elma-start"><button data-mode="text">${icons["message-square"]} ${labels.chat}</button><button data-mode="voice">${icons.mic} ${labels.voice}</button></div><p class="elma-status" role="status">${escape(labels.notice)}</p></div>`;
    panel.querySelector(".elma-close").onclick = () => close();
    panel
      .querySelectorAll("[data-mode]")
      .forEach((b) => (b.onclick = () => start(b.dataset.mode)));
    document.body.appendChild(panel);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    fit();
    panel.querySelector(".elma-close").focus();
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
    scenario = scenarios.includes(params.get("elma-scenario"))
      ? params.get("elma-scenario")
      : null;
    const cid = params.get("elma-conversation");
    fresh = !!scenario && !cid;
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
  window.addEventListener("elma:open", (event) => {
    const detail = event.detail;
    if (detail?.agent && detail.agent !== publication) return;
    if (detail?.scenario != null) {
      if (!scenarios.includes(detail.scenario)) return;
      close(false);
      scenario = detail.scenario;
      fresh = true;
      route({
        "elma-agent": publication,
        "elma-conversation": null,
        "elma-scenario": scenario,
        ...Object.fromEntries(routeKeys.map((k) => ["elma-" + k, null])),
      });
      open(false);
    } else open();
  });
  const capabilities = Object.freeze({
    version: 2,
    agent: publication,
    features: Object.freeze(["branding", "scenarios", "demo"]),
  });
  window.elmaWidgets ||= {};
  window.elmaWidgets[publication] = capabilities;
  window.dispatchEvent(
    new CustomEvent("elma:widget-ready", { detail: capabilities }),
  );
  restore();
})();
