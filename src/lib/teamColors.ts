// Representative flag colours per team (1–3 stripes, in flag order), used to render each
// outcome arc of the prediction donut so it resembles that country's flag — far more
// recognisable than a single colour, and distinguishable even when two teams share a hue.
// "Black" flag stripes are lifted to a dark grey so they read on the dark track, and white
// is softened slightly. Netherlands uses its iconic orange (unique among the field).
const BLACK = "#3a3a3f";
const WHITE = "#eef2f0";

const TEAM_COLORS: Record<string, string[]> = {
  algeria: ["#0a7d3b", WHITE, "#d21034"],
  argentina: ["#74acdf", WHITE],
  australia: ["#ffcd00", "#00843d"],
  austria: ["#ed2939", WHITE],
  belgium: [BLACK, "#fdda24", "#ef3340"],
  "bosnia-and-herzegovina": ["#002395", "#fecb00"],
  brazil: ["#009c3b", "#ffdf00", "#002776"],
  canada: ["#d52b1e", WHITE],
  "cape-verde-islands": ["#1c4f9c", WHITE, "#cf2027"],
  colombia: ["#fcd116", "#003893", "#ce1126"],
  "congo-dr": ["#007fff", "#f7d518", "#ce1021"],
  croatia: ["#ff0000", WHITE, "#171796"],
  curacao: ["#002b7f", "#f9e814"],
  czechia: ["#11457e", WHITE, "#d7141a"],
  ecuador: ["#ffdd00", "#034ea2", "#ed1c24"],
  egypt: ["#ce1126", WHITE, BLACK],
  england: [WHITE, "#cf081f"],
  france: ["#0055a4", WHITE, "#ef4135"],
  germany: [BLACK, "#dd0000", "#ffce00"],
  ghana: ["#ce1126", "#fcd116", "#006b3f"],
  haiti: ["#00209f", "#d21034"],
  iran: ["#239f40", WHITE, "#da0000"],
  iraq: ["#ce1126", WHITE, BLACK],
  "ivory-coast": ["#f77f00", WHITE, "#009e60"],
  japan: [WHITE, "#bc002d"],
  jordan: [BLACK, WHITE, "#ce1126"],
  mexico: ["#006847", WHITE, "#ce1126"],
  morocco: ["#c1272d", "#006233"],
  netherlands: ["#ff7900"],
  "new-zealand": ["#00247d", "#cc142b", WHITE],
  norway: ["#ba0c2f", WHITE, "#00205b"],
  panama: ["#d21034", WHITE, "#005293"],
  paraguay: ["#d52b1e", WHITE, "#0038a8"],
  portugal: ["#006600", "#ff0000"],
  qatar: ["#8a1538", WHITE],
  "saudi-arabia": ["#006c35", WHITE],
  scotland: ["#0065bd", WHITE],
  senegal: ["#00853f", "#fdef42", "#e31b23"],
  "south-africa": ["#007a4d", "#ffb612", "#de3831"],
  "south-korea": [WHITE, "#cd2e3a", "#0047a0"],
  spain: ["#c60b1e", "#ffc400"],
  sweden: ["#005293", "#fecb00"],
  switzerland: ["#d52b1e", WHITE],
  tunisia: ["#e70013", WHITE],
  turkiye: ["#e30a17", WHITE],
  uruguay: ["#0038a8", WHITE, "#fcd116"],
  usa: ["#b22234", WHITE, "#3c3b6e"],
  uzbekistan: ["#0099b5", WHITE, "#1eb53a"],
};

export const teamColors = (teamId: string): string[] => TEAM_COLORS[teamId] ?? ["#64748b"];
