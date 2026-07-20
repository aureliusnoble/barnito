import type { ETeam } from "../types";

// 24 mock Euro 2028 finalists. Hosts (ENG/SCO/WAL/IRL) sit in different groups.
// Group layout matches data/fixtures.ts exactly. Ratings drive all mock odds.
export const TEAMS: ETeam[] = [
  // Group A
  { id: "england", name: "England", code: "ENG", group: "A", rating: 2000, color: "#FFFFFF", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "serbia", name: "Serbia", code: "SRB", group: "A", rating: 1730, color: "#B72025", flag: "🇷🇸" },
  { id: "switzerland", name: "Switzerland", code: "SUI", group: "A", rating: 1800, color: "#D52B1E", flag: "🇨🇭" },
  { id: "hungary", name: "Hungary", code: "HUN", group: "A", rating: 1710, color: "#CD2A3E", flag: "🇭🇺" },
  // Group B
  { id: "spain", name: "Spain", code: "ESP", group: "B", rating: 2050, color: "#E4312B", flag: "🇪🇸" },
  { id: "croatia", name: "Croatia", code: "CRO", group: "B", rating: 1840, color: "#ED1C24", flag: "🇭🇷" },
  { id: "czechia", name: "Czechia", code: "CZE", group: "B", rating: 1720, color: "#D7141A", flag: "🇨🇿" },
  { id: "wales", name: "Wales", code: "WAL", group: "B", rating: 1670, color: "#C8102E", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  // Group C
  { id: "france", name: "France", code: "FRA", group: "C", rating: 2030, color: "#0055A4", flag: "🇫🇷" },
  { id: "ukraine", name: "Ukraine", code: "UKR", group: "C", rating: 1750, color: "#FFD500", flag: "🇺🇦" },
  { id: "austria", name: "Austria", code: "AUT", group: "C", rating: 1790, color: "#EF3340", flag: "🇦🇹" },
  { id: "scotland", name: "Scotland", code: "SCO", group: "C", rating: 1690, color: "#1D4F91", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  // Group D
  { id: "germany", name: "Germany", code: "GER", group: "D", rating: 1950, color: "#EDEDED", flag: "🇩🇪" },
  { id: "denmark", name: "Denmark", code: "DEN", group: "D", rating: 1810, color: "#C60C30", flag: "🇩🇰" },
  { id: "turkiye", name: "Türkiye", code: "TUR", group: "D", rating: 1770, color: "#E30A17", flag: "🇹🇷" },
  { id: "republic-of-ireland", name: "Republic of Ireland", code: "IRL", group: "D", rating: 1650, color: "#169B62", flag: "🇮🇪" },
  // Group E
  { id: "portugal", name: "Portugal", code: "POR", group: "E", rating: 1960, color: "#9E1B32", flag: "🇵🇹" },
  { id: "netherlands", name: "Netherlands", code: "NED", group: "E", rating: 1920, color: "#F36C21", flag: "🇳🇱" },
  { id: "poland", name: "Poland", code: "POL", group: "E", rating: 1740, color: "#DC143C", flag: "🇵🇱" },
  { id: "greece", name: "Greece", code: "GRE", group: "E", rating: 1600, color: "#0D5EAF", flag: "🇬🇷" },
  // Group F
  { id: "italy", name: "Italy", code: "ITA", group: "F", rating: 1890, color: "#0066BF", flag: "🇮🇹" },
  { id: "belgium", name: "Belgium", code: "BEL", group: "F", rating: 1860, color: "#E30613", flag: "🇧🇪" },
  { id: "norway", name: "Norway", code: "NOR", group: "F", rating: 1780, color: "#EF2B2D", flag: "🇳🇴" },
  { id: "sweden", name: "Sweden", code: "SWE", group: "F", rating: 1700, color: "#FFCD00", flag: "🇸🇪" },
];
