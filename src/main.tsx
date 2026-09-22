import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";

/**
 * `?debug` turns on frame-time and long-task logging. It is a dynamic import so
 * the instrumentation is its own chunk and no visitor without the flag pays for
 * it — which also means it can be run against a production build, which is the
 * only build whose numbers mean anything.
 */
if (typeof location !== "undefined" && new URLSearchParams(location.search).has("debug")) {
  void import("./debug/perf").then((m) => m.startPerfLogger());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
