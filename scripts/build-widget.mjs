// Reuse the app's pinned Lucide icons for static HTML and the standalone widget.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  X,
  Mic,
  MessageSquare,
  Quote,
  FileText,
  Check,
  ClipboardList,
  Image,
  ClipboardCheck,
  Phone,
  QrCode,
  BookOpen,
  AudioLines,
  PanelTop,
  ChartNoAxesCombined,
  Users,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const components = {
  "arrow-up-right": ArrowUpRight,
  "arrow-right": ArrowRight,
  sparkles: Sparkles,
  x: X,
  mic: Mic,
  "message-square": MessageSquare,
  quote: Quote,
  "file-text": FileText,
  check: Check,
  "clipboard-list": ClipboardList,
  image: Image,
  "clipboard-check": ClipboardCheck,
  phone: Phone,
  "qr-code": QrCode,
  "book-open": BookOpen,
  "audio-lines": AudioLines,
  "panel-top": PanelTop,
  "chart-no-axes-combined": ChartNoAxesCombined,
  users: Users,
  pause: Pause,
  play: Play,
  "rotate-ccw": RotateCcw,
};
const icons = Object.fromEntries(
  Object.entries(components).map(([name, icon]) => [
    name,
    renderToStaticMarkup(
      createElement(icon, { size: 20, "aria-hidden": true, focusable: false }),
    ),
  ]),
);
const sprite = Object.entries(icons)
  .map(
    ([name, svg]) =>
      `<symbol id="${name}" viewBox="0 0 24 24">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</symbol>`,
  )
  .join("\n");
writeFileSync(
  "apps/landing/public/icons.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${sprite}\n</svg>\n`,
);
mkdirSync("packages/agent-widget/dist", { recursive: true });
writeFileSync(
  "packages/agent-widget/dist/widget.js",
  readFileSync("packages/agent-widget/widget.js", "utf8")
    .replace("__ELMA_ICONS__", JSON.stringify(icons))
    .replace(
      "__ELMA_WIDGET_CSS__",
      JSON.stringify(readFileSync("packages/agent-widget/widget.css", "utf8")),
    ),
);
