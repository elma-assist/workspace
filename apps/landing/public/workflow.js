(() => {
  const t = (text) => window.ElmaLanding.t(text);
  const root = document.querySelector(".workflow");
  if (!root) return;
  const scenes = [...root.querySelectorAll("[data-scene]")];
  const steps = [...root.querySelectorAll("[data-step-button]")];
  const toggle = root.querySelector(".play-toggle");
  const icon = toggle.querySelector("use");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 6500;
  const names = [
    "Conversation",
    "Clarifying details",
    "Resident review",
    "Staff review",
  ];
  let index = 0,
    elapsed = 0,
    paused = motion.matches,
    visible = false;
  let frame = 0,
    previous = 0;
  const finished = () => index === scenes.length - 1 && elapsed >= duration;
  const canPlay = () => !paused && visible && !document.hidden && !finished();
  function paint() {
    root.dataset.step = String(index);
    root.style.setProperty("--progress", String(elapsed / duration));
    scenes.forEach((scene, i) => {
      scene.classList.toggle("is-active", i === index);
      scene.setAttribute("aria-hidden", String(i !== index));
      scene.inert = i !== index;
    });
    steps.forEach((step, i) =>
      i === index
        ? step.setAttribute("aria-current", "step")
        : step.removeAttribute("aria-current"),
    );
    root.querySelector(".context-status").textContent = t(names[index]);
  }
  function sync() {
    cancelAnimationFrame(frame);
    previous = 0;
    const playing = canPlay();
    root.dataset.playing = String(playing);
    toggle.setAttribute(
      "aria-label",
      t(
        finished()
          ? "Replay animation"
          : paused
            ? "Play animation"
            : "Pause animation",
      ),
    );
    icon.setAttribute(
      "href",
      finished()
        ? "/icons.svg#rotate-ccw"
        : paused
          ? "/icons.svg#play"
          : "/icons.svg#pause",
    );
    if (playing) frame = requestAnimationFrame(tick);
  }
  function tick(time) {
    if (!canPlay()) {
      sync();
      return;
    }
    if (previous) elapsed += Math.min(time - previous, 100);
    previous = time;
    if (elapsed >= duration) {
      elapsed = duration;
      if (index < scenes.length - 1) {
        index++;
        elapsed = 0;
      } else {
        paused = true;
        paint();
        sync();
        return;
      }
      paint();
    }
    root.style.setProperty("--progress", String(elapsed / duration));
    frame = requestAnimationFrame(tick);
  }
  steps.forEach((step, i) =>
    step.addEventListener("click", () => {
      index = i;
      elapsed = 0;
      paused = true;
      paint();
      sync();
    }),
  );
  toggle.addEventListener("click", () => {
    if (finished()) {
      index = 0;
      elapsed = 0;
      paused = false;
      paint();
    } else paused = !paused;
    sync();
  });
  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      sync();
    },
    { threshold: 0.15 },
  ).observe(root);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", () => {
    if (motion.matches) paused = true;
    sync();
  });
  window.addEventListener("elma:language-change", () => {
    paint();
    sync();
  });
  paint();
  sync();
})();
