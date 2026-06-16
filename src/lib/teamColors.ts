// Flag colours per team for the prediction donut. `colors` are the flag's stripes in order;
// `dir` is the orientation: "v" (vertical stripes, e.g. France) → drawn around the arc; "h"
// (horizontal stripes, e.g. Argentina/Germany) → concentric bands across the ring. Optional
// `weights` give each colour's share of the flag (so Switzerland/Turkey read mostly red, Korea
// mostly white, etc.); omitted = equal bands. Black is lifted to dark grey, white softened.
export type FlagDir = "h" | "v";
export interface Flag { colors: string[]; dir: FlagDir; weights?: number[] }

const BLACK = "#3a3a3f";
const WHITE = "#eef2f0";

const FLAGS: Record<string, Flag> = {
  algeria: { colors: ["#0a7d3b", WHITE, "#d21034"], dir: "v", weights: [0.45, 0.45, 0.1] },
  argentina: { colors: ["#74acdf", WHITE, "#74acdf"], dir: "h" },
  australia: { colors: ["#00843d", "#ffcd00"], dir: "h" },
  austria: { colors: ["#ed2939", WHITE, "#ed2939"], dir: "h" },
  belgium: { colors: [BLACK, "#fdda24", "#ef3340"], dir: "v" },
  "bosnia-and-herzegovina": { colors: ["#002395", "#fecb00"], dir: "v", weights: [0.62, 0.38] },
  brazil: { colors: ["#009c3b", "#ffdf00", "#002776"], dir: "h", weights: [0.58, 0.28, 0.14] },
  canada: { colors: ["#d52b1e", WHITE, "#d52b1e"], dir: "v", weights: [0.25, 0.5, 0.25] },
  "cape-verde-islands": { colors: ["#1c4f9c", WHITE, "#cf2027"], dir: "h", weights: [0.55, 0.27, 0.18] },
  colombia: { colors: ["#fcd116", "#003893", "#ce1126"], dir: "h", weights: [0.5, 0.25, 0.25] },
  "congo-dr": { colors: ["#007fff", "#f7d518", "#ce1021"], dir: "v" },
  croatia: { colors: ["#ff0000", WHITE, "#171796"], dir: "h" },
  curacao: { colors: ["#002b7f", "#f9e814"], dir: "h", weights: [0.78, 0.22] },
  czechia: { colors: ["#11457e", WHITE, "#d7141a"], dir: "h" },
  ecuador: { colors: ["#ffdd00", "#034ea2", "#ed1c24"], dir: "h", weights: [0.5, 0.25, 0.25] },
  egypt: { colors: ["#ce1126", WHITE, BLACK], dir: "h" },
  england: { colors: [WHITE, "#cf081f", WHITE], dir: "h", weights: [0.4, 0.2, 0.4] }, // red cross on white
  // (a true 2-D cross isn't legible at donut scale; a centre band reads as the cross stripe)
  france: { colors: ["#0055a4", WHITE, "#ef4135"], dir: "v" },
  germany: { colors: [BLACK, "#dd0000", "#ffce00"], dir: "h" },
  ghana: { colors: ["#ce1126", "#fcd116", "#006b3f"], dir: "h" },
  haiti: { colors: ["#00209f", "#d21034"], dir: "h" },
  iran: { colors: ["#239f40", WHITE, "#da0000"], dir: "h" },
  iraq: { colors: ["#ce1126", WHITE, BLACK], dir: "h" },
  "ivory-coast": { colors: ["#f77f00", WHITE, "#009e60"], dir: "v" },
  japan: { colors: ["#bc002d", WHITE], dir: "h", weights: [0.22, 0.78] }, // red disc in the centre
  jordan: { colors: [BLACK, WHITE, "#007a3d"], dir: "h" },
  mexico: { colors: ["#006847", WHITE, "#ce1126"], dir: "v" },
  morocco: { colors: ["#c1272d", "#006233"], dir: "h", weights: [0.8, 0.2] },
  netherlands: { colors: ["#ae1c28", WHITE, "#21468b"], dir: "h" },
  "new-zealand": { colors: ["#00247d", "#cc142b", WHITE], dir: "h", weights: [0.62, 0.2, 0.18] },
  norway: { colors: ["#ba0c2f", WHITE, "#00205b"], dir: "h", weights: [0.46, 0.2, 0.34] },
  panama: { colors: ["#d21034", WHITE, "#005293"], dir: "h" },
  paraguay: { colors: ["#d52b1e", WHITE, "#0038a8"], dir: "h" },
  portugal: { colors: ["#006600", "#ff0000"], dir: "v", weights: [0.4, 0.6] },
  qatar: { colors: ["#8a1538", WHITE], dir: "v", weights: [0.7, 0.3] },
  "saudi-arabia": { colors: ["#006c35", WHITE], dir: "h", weights: [0.82, 0.18] },
  scotland: { colors: ["#0065bd", WHITE, "#0065bd"], dir: "h", weights: [0.4, 0.2, 0.4] }, // white saltire on blue
  senegal: { colors: ["#00853f", "#fdef42", "#e31b23"], dir: "v" },
  "south-africa": { colors: ["#007a4d", "#ffb612", "#de3831"], dir: "h" },
  "south-korea": { colors: [WHITE, "#cd2e3a", "#0047a0"], dir: "h", weights: [0.58, 0.22, 0.2] },
  spain: { colors: ["#c60b1e", "#ffc400", "#c60b1e"], dir: "h", weights: [0.25, 0.5, 0.25] },
  sweden: { colors: ["#005293", "#fecb00", "#005293"], dir: "h", weights: [0.4, 0.2, 0.4] }, // yellow cross on blue
  switzerland: { colors: ["#d52b1e", WHITE, "#d52b1e"], dir: "h", weights: [0.4, 0.2, 0.4] }, // white cross on red
  tunisia: { colors: ["#e70013", WHITE], dir: "h", weights: [0.78, 0.22] },
  turkiye: { colors: ["#e30a17", WHITE], dir: "h", weights: [0.82, 0.18] },
  uruguay: { colors: ["#0038a8", WHITE, "#0038a8"], dir: "h" },
  usa: { colors: ["#b22234", WHITE, "#3c3b6e"], dir: "h", weights: [0.4, 0.34, 0.26] },
  uzbekistan: { colors: ["#0099b5", WHITE, "#1eb53a"], dir: "h" },
};

export const teamFlag = (teamId: string): Flag => FLAGS[teamId] ?? { colors: ["#64748b"], dir: "h" };
