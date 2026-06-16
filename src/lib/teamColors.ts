// Flag colours per team for the prediction donut. `colors` are the flag's stripes in order;
// `dir` is the stripe orientation: "v" (vertical stripes, e.g. France) → drawn around the arc;
// "h" (horizontal stripes, e.g. Argentina/Germany) → drawn as concentric bands across the ring.
// Black is lifted to dark grey and white softened so they read on the dark track.
export type FlagDir = "h" | "v";
export interface Flag { colors: string[]; dir: FlagDir }

const BLACK = "#3a3a3f";
const WHITE = "#eef2f0";

const FLAGS: Record<string, Flag> = {
  algeria: { colors: ["#0a7d3b", WHITE, "#d21034"], dir: "v" },
  argentina: { colors: ["#74acdf", WHITE, "#74acdf"], dir: "h" },
  australia: { colors: ["#00843d", "#ffcd00"], dir: "h" },
  austria: { colors: ["#ed2939", WHITE, "#ed2939"], dir: "h" },
  belgium: { colors: [BLACK, "#fdda24", "#ef3340"], dir: "v" },
  "bosnia-and-herzegovina": { colors: ["#002395", "#fecb00"], dir: "v" },
  brazil: { colors: ["#009c3b", "#ffdf00", "#002776"], dir: "h" },
  canada: { colors: ["#d52b1e", WHITE, "#d52b1e"], dir: "v" },
  "cape-verde-islands": { colors: ["#1c4f9c", WHITE, "#cf2027"], dir: "h" },
  colombia: { colors: ["#fcd116", "#003893", "#ce1126"], dir: "h" },
  "congo-dr": { colors: ["#007fff", "#f7d518", "#ce1021"], dir: "v" },
  croatia: { colors: ["#ff0000", WHITE, "#171796"], dir: "h" },
  curacao: { colors: ["#002b7f", "#f9e814"], dir: "h" },
  czechia: { colors: ["#11457e", WHITE, "#d7141a"], dir: "h" },
  ecuador: { colors: ["#ffdd00", "#034ea2", "#ed1c24"], dir: "h" },
  egypt: { colors: ["#ce1126", WHITE, BLACK], dir: "h" },
  england: { colors: [WHITE, "#cf081f"], dir: "h" },
  france: { colors: ["#0055a4", WHITE, "#ef4135"], dir: "v" },
  germany: { colors: [BLACK, "#dd0000", "#ffce00"], dir: "h" },
  ghana: { colors: ["#ce1126", "#fcd116", "#006b3f"], dir: "h" },
  haiti: { colors: ["#00209f", "#d21034"], dir: "h" },
  iran: { colors: ["#239f40", WHITE, "#da0000"], dir: "h" },
  iraq: { colors: ["#ce1126", WHITE, BLACK], dir: "h" },
  "ivory-coast": { colors: ["#f77f00", WHITE, "#009e60"], dir: "v" },
  japan: { colors: [WHITE, "#bc002d"], dir: "h" },
  jordan: { colors: [BLACK, WHITE, "#007a3d"], dir: "h" },
  mexico: { colors: ["#006847", WHITE, "#ce1126"], dir: "v" },
  morocco: { colors: ["#c1272d", "#006233"], dir: "h" },
  netherlands: { colors: ["#ff7900"], dir: "h" },
  "new-zealand": { colors: ["#00247d", "#cc142b", WHITE], dir: "h" },
  norway: { colors: ["#ba0c2f", WHITE, "#00205b"], dir: "h" },
  panama: { colors: ["#d21034", WHITE, "#005293"], dir: "h" },
  paraguay: { colors: ["#d52b1e", WHITE, "#0038a8"], dir: "h" },
  portugal: { colors: ["#006600", "#ff0000"], dir: "v" },
  qatar: { colors: ["#8a1538", WHITE], dir: "v" },
  "saudi-arabia": { colors: ["#006c35", WHITE], dir: "h" },
  scotland: { colors: ["#0065bd", WHITE], dir: "h" },
  senegal: { colors: ["#00853f", "#fdef42", "#e31b23"], dir: "v" },
  "south-africa": { colors: ["#007a4d", "#ffb612", "#de3831"], dir: "h" },
  "south-korea": { colors: [WHITE, "#cd2e3a", "#0047a0"], dir: "h" },
  spain: { colors: ["#c60b1e", "#ffc400", "#c60b1e"], dir: "h" },
  sweden: { colors: ["#005293", "#fecb00"], dir: "h" },
  switzerland: { colors: ["#d52b1e", WHITE], dir: "h" },
  tunisia: { colors: ["#e70013", WHITE], dir: "h" },
  turkiye: { colors: ["#e30a17", WHITE], dir: "h" },
  uruguay: { colors: ["#0038a8", WHITE, "#0038a8"], dir: "h" },
  usa: { colors: ["#b22234", WHITE, "#3c3b6e"], dir: "h" },
  uzbekistan: { colors: ["#0099b5", WHITE, "#1eb53a"], dir: "h" },
};

export const teamFlag = (teamId: string): Flag => FLAGS[teamId] ?? { colors: ["#64748b"], dir: "h" };
