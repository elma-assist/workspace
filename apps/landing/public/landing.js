(() => {
  let ready = false,
    pendingOpen = false,
    failed = false;
  const t = (text) => window.ElmaLanding.t(text);
  function showError() {
    if (!failed) return;
    document.querySelectorAll(".widget-error").forEach((message) => {
      message.textContent = t(
        "The live demo is temporarily unavailable. Please try again later.",
      );
    });
  }
  window.addEventListener("elma:language-change", showError);
  const actions = [...document.querySelectorAll("[data-open-agent]")];
  function open() {
    if (pendingOpen && !ready) return;
    if (ready) window.dispatchEvent(new Event("elma:open"));
    else {
      pendingOpen = true;
      actions.forEach((button) => {
        button.setAttribute("aria-busy", "true");
        button.disabled = true;
      });
    }
  }
  actions.forEach((button) => button.addEventListener("click", open));
  fetch("/api/demo")
    .then((response) => {
      if (!response.ok) throw new Error("Demo unavailable");
      return response.json();
    })
    .then(
      (data) =>
        new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/widget.js";
          script.dataset.agent = data.publication_id;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        }),
    )
    .then(() => {
      ready = true;
      actions.forEach((button) => {
        button.removeAttribute("aria-busy");
        button.disabled = false;
      });
      if (pendingOpen) open();
    })
    .catch(() => {
      actions.forEach((button) => {
        button.removeAttribute("aria-busy");
        button.disabled = true;
      });
      failed = true;
      showError();
    });
})();
