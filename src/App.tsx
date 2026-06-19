import { Routes, Route } from "react-router-dom";
import { useDataState } from "./data/store";
import Layout from "./components/Layout";
import Today from "./pages/Today";
import Matches from "./pages/Matches";
import Leaderboard from "./pages/Leaderboard";
import Groups from "./pages/Groups";
import Scorers from "./pages/Scorers";
import Spicy from "./pages/Spicy";
import Daily from "./pages/Daily";

export default function App() {
  const { loading, error } = useDataState();

  if (loading) {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center gap-4 text-pitch-200">
        <div className="animate-spin text-5xl">⚽</div>
        <p className="font-display text-lg">Loading Barnito…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">🥅</div>
        <h1 className="font-display text-xl font-bold">Couldn't load the data</h1>
        <p className="max-w-sm text-sm text-pitch-300">{error}</p>
        <p className="text-xs text-pitch-400">
          If this just deployed, the data files may not be generated yet.
        </p>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/scorers" element={<Scorers />} />
        <Route path="/spicy" element={<Spicy />} />
        <Route path="/daily" element={<Daily />} />
        <Route path="*" element={<Today />} />
      </Routes>
    </Layout>
  );
}
