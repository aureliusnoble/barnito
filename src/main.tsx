import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { DataProvider } from "./data/store";
import { startAutoUpdate } from "./lib/autoUpdate";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <DataProvider>
        <App />
      </DataProvider>
    </HashRouter>
  </React.StrictMode>,
);

// Register the service worker so the app is installable to the home screen.
// Scoped/served under Vite's base (e.g. /barnito/) so it controls the deployed app.
// Reload clients onto the newest deployed build (SPAs otherwise run stale until manually reloaded).
if (import.meta.env.PROD) startAutoUpdate();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const base = import.meta.env.BASE_URL;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* install-to-home-screen just won't be offered; app still works */
    });
  });
}
