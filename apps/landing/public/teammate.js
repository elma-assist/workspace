(() => {
  const scene = document.querySelector(".teammate-motion");
  if (!scene) return;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  const sync = () => {
    if (motion.matches) {
      scene.classList.remove("is-playing");
      return;
    }
    if (visible) scene.classList.add("is-playing");
    scene.classList.toggle("is-paused", !visible || document.hidden);
  };
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      sync();
    },
    { threshold: 0.35 },
  ).observe(scene);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", sync);
})();
