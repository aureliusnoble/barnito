// Official FIFA/Coca-Cola Men's World Ranking — published 11 June 2026 (the edition issued just
// before the 2026 World Cup; next official update 20 July 2026). API-Football has no ranking
// endpoint, so these are maintained by hand. Keyed by team slug (slug(name)) to match teams.id;
// unknown teams simply show no rank. Source: FIFA.com / inside.fifa.com.
export const FIFA_RANKS: Record<string, number> = {
  // --- 2026 World Cup teams (slugs match the API-Football-derived teams.id) ---
  argentina: 1, spain: 2, france: 3, england: 4, portugal: 5, brazil: 6, morocco: 7,
  netherlands: 8, belgium: 9, germany: 10, croatia: 11, colombia: 13, mexico: 14,
  senegal: 15, uruguay: 16, usa: 17, japan: 18, switzerland: 19, iran: 20, turkiye: 22,
  ecuador: 23, austria: 24, "south-korea": 25, australia: 27, algeria: 28, egypt: 29,
  canada: 30, norway: 31, "ivory-coast": 33, panama: 34, sweden: 38, czechia: 40,
  paraguay: 41, scotland: 42, tunisia: 45, "congo-dr": 46, uzbekistan: 50, qatar: 56,
  iraq: 57, "south-africa": 60, "saudi-arabia": 61, jordan: 63, "bosnia-and-herzegovina": 64,
  "cape-verde-islands": 67, ghana: 73, curacao: 82, haiti: 83, "new-zealand": 85,

  // --- aliases / alternate slugs (kept so a different API name still resolves) ---
  italy: 12, denmark: 21, nigeria: 26, ukraine: 32, russia: 35, poland: 36, wales: 37,
  hungary: 39, serbia: 43, cameroon: 44, slovakia: 47, greece: 48, venezuela: 49,
  "cote-divoire": 33, "cote-d-ivoire": 33, "korea-republic": 25, "ir-iran": 20, turkey: 22,
  "cabo-verde": 67, "cape-verde": 67, "dr-congo": 46, "czech-republic": 40,
};
