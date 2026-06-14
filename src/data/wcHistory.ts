// Maintained static map of each nation's World Cup pedigree, keyed by team slug (teams.id).
// API-Football has no "best/last finish" field, so this is hand-kept (approximate, men's WC).
//  - best:   best-ever finish + year(s)
//  - recent: result the last time they appeared (or "Debut" for first-timers in 2026)
export interface WcHistory {
  best: string;
  recent: string;
}

export const WC_HISTORY: Record<string, WcHistory> = {
  argentina: { best: "Winners (1978, 1986, 2022)", recent: "Winners (2022)" },
  brazil: { best: "Winners ×5 (1958–2002)", recent: "Quarter-finals (2022)" },
  france: { best: "Winners (1998, 2018)", recent: "Runners-up (2022)" },
  germany: { best: "Winners ×4 (1954–2014)", recent: "Group stage (2022)" },
  spain: { best: "Winners (2010)", recent: "Round of 16 (2022)" },
  england: { best: "Winners (1966)", recent: "Quarter-finals (2022)" },
  portugal: { best: "Fourth place (1966, 2006)", recent: "Quarter-finals (2022)" },
  netherlands: { best: "Runners-up (1974, 1978, 2010)", recent: "Quarter-finals (2022)" },
  belgium: { best: "Third place (2018)", recent: "Group stage (2022)" },
  croatia: { best: "Runners-up (2018)", recent: "Third place (2022)" },
  uruguay: { best: "Winners (1930, 1950)", recent: "Group stage (2022)" },
  morocco: { best: "Fourth place (2022)", recent: "Fourth place (2022)" },
  colombia: { best: "Quarter-finals (2014)", recent: "Round of 16 (2018)" },
  mexico: { best: "Quarter-finals (1970, 1986)", recent: "Group stage (2022)" },
  usa: { best: "Third place (1930)", recent: "Round of 16 (2022)" },
  switzerland: { best: "Quarter-finals (1934, 1938, 1954)", recent: "Round of 16 (2022)" },
  japan: { best: "Round of 16 (2002, 2010, 2018, 2022)", recent: "Round of 16 (2022)" },
  senegal: { best: "Quarter-finals (2002)", recent: "Round of 16 (2022)" },
  iran: { best: "Group stage", recent: "Group stage (2022)" },
  "south-korea": { best: "Fourth place (2002)", recent: "Round of 16 (2022)" },
  australia: { best: "Round of 16 (2006, 2022)", recent: "Round of 16 (2022)" },
  ecuador: { best: "Round of 16 (2006)", recent: "Group stage (2022)" },
  austria: { best: "Third place (1954)", recent: "Group stage (1998)" },
  "ivory-coast": { best: "Group stage", recent: "Group stage (2014)" },
  canada: { best: "Group stage (1986, 2022)", recent: "Group stage (2022)" },
  algeria: { best: "Round of 16 (2014)", recent: "Group stage (2014)" },
  scotland: { best: "Group stage", recent: "Group stage (1998)" },
  norway: { best: "Round of 16 (1998)", recent: "Round of 16 (1998)" },
  czechia: { best: "Runners-up (1934, 1962, as Czechoslovakia)", recent: "Group stage (2006)" },
  "saudi-arabia": { best: "Round of 16 (1994)", recent: "Group stage (2022)" },
  paraguay: { best: "Quarter-finals (2010)", recent: "Group stage (2010)" },
  tunisia: { best: "Group stage", recent: "Group stage (2022)" },
  sweden: { best: "Runners-up (1958)", recent: "Quarter-finals (2018)" },
  ghana: { best: "Quarter-finals (2010)", recent: "Group stage (2022)" },
  egypt: { best: "Group stage", recent: "Group stage (2018)" },
  "south-africa": { best: "Group stage (1998, 2002, 2010)", recent: "Group stage (2010)" },
  qatar: { best: "Group stage (2022)", recent: "Group stage (2022)" },
  "bosnia-and-herzegovina": { best: "Group stage (2014)", recent: "Group stage (2014)" },
  panama: { best: "Group stage (2018)", recent: "Group stage (2018)" },
  haiti: { best: "Group stage (1974)", recent: "Group stage (1974)" },
  "new-zealand": { best: "Group stage (1982, 2010)", recent: "Group stage (2010)" },
  "congo-dr": { best: "Group stage (1974, as Zaire)", recent: "Group stage (1974)" },
  iraq: { best: "Group stage (1986)", recent: "Group stage (1986)" },
  turkiye: { best: "Third place (2002)", recent: "Third place (2002)" },
  // 2026 debutants
  "cape-verde-islands": { best: "Debut", recent: "Debut (2026)" },
  curacao: { best: "Debut", recent: "Debut (2026)" },
  jordan: { best: "Debut", recent: "Debut (2026)" },
  uzbekistan: { best: "Debut", recent: "Debut (2026)" },
};
