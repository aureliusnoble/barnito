// Maintained FIFA men's world-ranking estimates by team slug (API-Football has no ranking endpoint).
// Approximate / easy to refresh; unknown teams simply show no rank. Keyed by slug(name).
export const FIFA_RANKS: Record<string, number> = {
  argentina: 1, spain: 2, france: 3, england: 4, brazil: 5, portugal: 6, netherlands: 7,
  belgium: 8, italy: 9, germany: 10, croatia: 11, morocco: 12, colombia: 13, uruguay: 14,
  usa: 15, mexico: 16, switzerland: 17, senegal: 18, japan: 19, denmark: 20, iran: 21,
  "south-korea": 22, australia: 23, ecuador: 24, austria: 25, ukraine: 26, "ivory-coast": 27,
  "cote-divoire": 27, canada: 28, nigeria: 29, turkey: 30, turkiye: 30, panama: 31, egypt: 32,
  algeria: 33, scotland: 34, norway: 35, hungary: 36, serbia: 37, poland: 38, wales: 39,
  greece: 40, "czech-republic": 41, czechia: 41, "saudi-arabia": 42, peru: 43, paraguay: 44,
  tunisia: 45, "costa-rica": 46, sweden: 47, mali: 48, "south-africa": 50, ghana: 51,
  jordan: 62, uzbekistan: 57, qatar: 36, "cape-verde": 70, curacao: 90, haiti: 83,
  "bosnia-and-herzegovina": 74, "new-zealand": 86, "dr-congo": 60, iraq: 58,
};
