import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { DataProvider } from "./data/store";

// Serve public/data/*.json through a fetch shim so the real DataProvider loads them.
beforeAll(() => {
  const dataDir = resolve(__dirname, "../public/data");
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const file = url.split("?")[0].replace(/^.*\/data\//, "");
    const body = readFileSync(resolve(dataDir, file), "utf8");
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(body),
    } as Response;
  }) as typeof fetch;
});

afterEach(() => cleanup());

function renderApp() {
  return render(
    <HashRouter>
      <DataProvider>
        <App />
      </DataProvider>
    </HashRouter>,
  );
}

describe("app smoke test", () => {
  it("loads and shows the leader on the Today page", async () => {
    renderApp();
    await waitFor(() => expect(screen.getByText("Barnito")).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Current leader/i)).toBeTruthy());
  });

  it("renders every page without crashing", async () => {
    renderApp();
    await waitFor(() => expect(screen.getByText("Barnito")).toBeTruthy());

    const routes: [string, RegExp][] = [
      ["#/leaderboard", /Leaderboard/i],
      ["#/groups", /Group A/i],
      ["#/scorers", /Goal scorers/i],
      ["#/spicy", /Spicy games/i],
      ["#/matches", /Group|Matchday/i],
    ];
    for (const [hash, expected] of routes) {
      window.location.hash = hash;
      await waitFor(() => expect(screen.getAllByText(expected).length).toBeGreaterThan(0));
    }
  });

  it("opens a match detail modal when a match is clicked", async () => {
    renderApp();
    await waitFor(() => expect(screen.getByText("Barnito")).toBeTruthy());
    window.location.hash = "#/matches";
    const buttons = await waitFor(() => {
      const found = screen.getAllByRole("button");
      if (found.length < 5) throw new Error("not ready");
      return found;
    });
    // click the first match card (skip filter pills) — find one containing a score/time
    const card = buttons.find((b) => /\d/.test(b.textContent ?? "") && (b.textContent ?? "").length > 10);
    if (card) {
      fireEvent.click(card);
      await waitFor(() => expect(screen.getByText("Predictions")).toBeTruthy());
    }
  });
});
