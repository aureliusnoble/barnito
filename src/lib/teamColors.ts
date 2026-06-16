// A single representative flag colour per team, used to colour the prediction donuts
// (home-win segment = home colour, away-win = away colour, draw = grey). Black-dominant
// flags use a secondary flag colour so the segment reads on the dark UI.
const TEAM_COLOR: Record<string, string> = {
  algeria: "#1b8a4c", argentina: "#75aadb", australia: "#ffcd00", austria: "#ed2939",
  belgium: "#fdda24", "bosnia-and-herzegovina": "#1f3a93", brazil: "#facc15", canada: "#d52b1e",
  "cape-verde-islands": "#1c4f9c", colombia: "#fcd116", "congo-dr": "#1f8fff", croatia: "#d81e2c",
  curacao: "#00237f", czechia: "#11457e", ecuador: "#ffdd00", egypt: "#ce1126",
  england: "#e2e8f0", france: "#2155a4", germany: "#ffce00", ghana: "#f7c600",
  haiti: "#1e3fae", iran: "#239f40", iraq: "#b81d2b", "ivory-coast": "#f77f00",
  japan: "#bc002d", jordan: "#ce1126", mexico: "#006847", morocco: "#c1272d",
  netherlands: "#ff7900", "new-zealand": "#c8102e", norway: "#ba0c2f", panama: "#d21034",
  paraguay: "#2b4b9b", portugal: "#1f7a1f", qatar: "#8a1538", "saudi-arabia": "#006c35",
  scotland: "#0065bd", senegal: "#00853f", "south-africa": "#007a4d", "south-korea": "#2b4b9b",
  spain: "#c60b1e", sweden: "#1f6fb2", switzerland: "#d52b1e", tunisia: "#e70013",
  turkiye: "#e30a17", uruguay: "#5b92e5", usa: "#b22234", uzbekistan: "#0099b5",
};

export const teamColor = (teamId: string): string => TEAM_COLOR[teamId] ?? "#64748b";
