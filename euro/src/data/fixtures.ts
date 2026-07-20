// Barnito 28 — all 51 Euro 2028 fixtures (mocked schedule, UK & Ireland).
//
// Group stage (36 games), ids "g-A1".."g-F6". Real Euro round-robin pattern per
// group (T1..T4 = the group's four teams in data order):
//   MD1: T1 v T2 (X1), T3 v T4 (X2)
//   MD2: T1 v T3 (X3), T4 v T2 (X4)
//   MD3: T4 v T1 (X5), T2 v T3 (X6)  — both games kick off simultaneously.
// Matchday windows: MD1 9–12 June, MD2 17–20 June, MD3 26–28 June 2028.
// Kickoffs 14:00 / 17:00 / 20:00 UK; the UK is on BST (UTC+1) in June–July, so
// those are 13:00Z / 16:00Z / 19:00Z.
//
// Knockouts (teams null until the bracket advances): R16 30 June – 3 July
// (two per day), QF 6–7 July, SF 11–12 July (Wembley), Final 16 July (Wembley,
// 20:00 UK). Placeholder labels mirror lib/bracket.ts R16_TEMPLATE and KO_FEED
// exactly — e.g. qf-1 is fed by r16-3 (home) and r16-1 (away).
//
// Team ids match the agreed 24-team list (data/teams.ts):
//   A: england serbia switzerland hungary   B: spain croatia czechia wales
//   C: france ukraine austria scotland      D: germany denmark turkiye republic-of-ireland
//   E: portugal netherlands poland greece   F: italy belgium norway sweden

import type { EFixture, EGroup, EPhase } from "../types";

interface Venue {
  venue: string;
  city: string;
}

// The nine announced UK & Ireland venues.
const WEMBLEY: Venue = { venue: "Wembley Stadium", city: "London" };
const TOTTENHAM: Venue = { venue: "Tottenham Hotspur Stadium", city: "London" };
const ETIHAD: Venue = { venue: "Etihad Stadium", city: "Manchester" };
const HILL_DICKINSON: Venue = { venue: "Hill Dickinson Stadium", city: "Liverpool" };
const ST_JAMES: Venue = { venue: "St James' Park", city: "Newcastle" };
const VILLA_PARK: Venue = { venue: "Villa Park", city: "Birmingham" };
const PRINCIPALITY: Venue = { venue: "Principality Stadium", city: "Cardiff" };
const HAMPDEN: Venue = { venue: "Hampden Park", city: "Glasgow" };
const AVIVA: Venue = { venue: "Aviva Stadium", city: "Dublin" };

/** Group-stage fixture: teams known from the start. */
function g(
  id: string,
  group: EGroup,
  kickoff: string,
  at: Venue,
  homeTeamId: string,
  awayTeamId: string
): EFixture {
  return {
    id,
    phase: "group",
    group,
    kickoff,
    venue: at.venue,
    city: at.city,
    homeTeamId,
    awayTeamId,
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
    scorers: [],
  };
}

/** Knockout fixture: slots empty until the bracket fills them; labels shown meanwhile. */
function ko(
  id: string,
  phase: EPhase,
  kickoff: string,
  at: Venue,
  homeLabel: string,
  awayLabel: string
): EFixture {
  return {
    id,
    phase,
    kickoff,
    venue: at.venue,
    city: at.city,
    homeTeamId: null,
    awayTeamId: null,
    homeLabel,
    awayLabel,
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
    scorers: [],
    penWinnerTeamId: null,
  };
}

export const BASE_FIXTURES: EFixture[] = [
  // ------------------------------------------------------------------------
  // Matchday 1 — 9–12 June, three games a day
  // ------------------------------------------------------------------------
  g("g-A2", "A", "2028-06-09T13:00:00Z", ST_JAMES, "switzerland", "hungary"),
  g("g-B1", "B", "2028-06-09T16:00:00Z", VILLA_PARK, "spain", "croatia"),
  g("g-A1", "A", "2028-06-09T19:00:00Z", WEMBLEY, "england", "serbia"), // opening night

  g("g-B2", "B", "2028-06-10T13:00:00Z", PRINCIPALITY, "czechia", "wales"),
  g("g-C2", "C", "2028-06-10T16:00:00Z", HAMPDEN, "austria", "scotland"),
  g("g-C1", "C", "2028-06-10T19:00:00Z", HILL_DICKINSON, "france", "ukraine"),

  g("g-D2", "D", "2028-06-11T13:00:00Z", AVIVA, "turkiye", "republic-of-ireland"),
  g("g-E1", "E", "2028-06-11T16:00:00Z", ETIHAD, "portugal", "netherlands"),
  g("g-D1", "D", "2028-06-11T19:00:00Z", TOTTENHAM, "germany", "denmark"),

  g("g-E2", "E", "2028-06-12T13:00:00Z", HILL_DICKINSON, "poland", "greece"),
  g("g-F2", "F", "2028-06-12T16:00:00Z", ST_JAMES, "norway", "sweden"),
  g("g-F1", "F", "2028-06-12T19:00:00Z", VILLA_PARK, "italy", "belgium"),

  // ------------------------------------------------------------------------
  // Matchday 2 — 17–20 June, three games a day
  // ------------------------------------------------------------------------
  g("g-A4", "A", "2028-06-17T13:00:00Z", ETIHAD, "hungary", "serbia"),
  g("g-B3", "B", "2028-06-17T16:00:00Z", AVIVA, "spain", "czechia"),
  g("g-A3", "A", "2028-06-17T19:00:00Z", TOTTENHAM, "england", "switzerland"),

  g("g-B4", "B", "2028-06-18T13:00:00Z", PRINCIPALITY, "wales", "croatia"),
  g("g-C4", "C", "2028-06-18T16:00:00Z", HAMPDEN, "scotland", "ukraine"),
  g("g-C3", "C", "2028-06-18T19:00:00Z", WEMBLEY, "france", "austria"),

  g("g-D4", "D", "2028-06-19T13:00:00Z", AVIVA, "republic-of-ireland", "denmark"),
  g("g-E3", "E", "2028-06-19T16:00:00Z", VILLA_PARK, "portugal", "poland"),
  g("g-D3", "D", "2028-06-19T19:00:00Z", ETIHAD, "germany", "turkiye"),

  g("g-E4", "E", "2028-06-20T13:00:00Z", ST_JAMES, "greece", "netherlands"),
  g("g-F4", "F", "2028-06-20T16:00:00Z", HILL_DICKINSON, "sweden", "belgium"),
  g("g-F3", "F", "2028-06-20T19:00:00Z", TOTTENHAM, "italy", "norway"),

  // ------------------------------------------------------------------------
  // Matchday 3 — 26–28 June, two groups a day, each group's pair simultaneous
  // ------------------------------------------------------------------------
  g("g-B5", "B", "2028-06-26T16:00:00Z", PRINCIPALITY, "wales", "spain"),
  g("g-B6", "B", "2028-06-26T16:00:00Z", HILL_DICKINSON, "croatia", "czechia"),
  g("g-A5", "A", "2028-06-26T19:00:00Z", ETIHAD, "hungary", "england"),
  g("g-A6", "A", "2028-06-26T19:00:00Z", ST_JAMES, "serbia", "switzerland"),

  g("g-D5", "D", "2028-06-27T16:00:00Z", AVIVA, "republic-of-ireland", "germany"),
  g("g-D6", "D", "2028-06-27T16:00:00Z", VILLA_PARK, "denmark", "turkiye"),
  g("g-C5", "C", "2028-06-27T19:00:00Z", HAMPDEN, "scotland", "france"),
  g("g-C6", "C", "2028-06-27T19:00:00Z", TOTTENHAM, "ukraine", "austria"),

  g("g-E5", "E", "2028-06-28T16:00:00Z", WEMBLEY, "greece", "portugal"),
  g("g-E6", "E", "2028-06-28T16:00:00Z", ETIHAD, "netherlands", "poland"),
  g("g-F5", "F", "2028-06-28T19:00:00Z", VILLA_PARK, "sweden", "italy"),
  g("g-F6", "F", "2028-06-28T19:00:00Z", ST_JAMES, "belgium", "norway"),

  // ------------------------------------------------------------------------
  // Round of 16 — 30 June – 3 July, two games a day (slots per R16_TEMPLATE)
  // ------------------------------------------------------------------------
  ko("r16-1", "r16", "2028-06-30T16:00:00Z", HILL_DICKINSON, "Runner-up A", "Runner-up B"),
  ko("r16-2", "r16", "2028-06-30T19:00:00Z", WEMBLEY, "Winner A", "Runner-up C"),
  ko("r16-3", "r16", "2028-07-01T16:00:00Z", PRINCIPALITY, "Winner C", "3rd D/E/F"),
  ko("r16-4", "r16", "2028-07-01T19:00:00Z", TOTTENHAM, "Winner B", "3rd A/D/E/F"),
  ko("r16-5", "r16", "2028-07-02T16:00:00Z", AVIVA, "Runner-up D", "Runner-up E"),
  ko("r16-6", "r16", "2028-07-02T19:00:00Z", ETIHAD, "Winner F", "3rd A/B/C"),
  ko("r16-7", "r16", "2028-07-03T16:00:00Z", HAMPDEN, "Winner E", "3rd A/B/C/D"),
  ko("r16-8", "r16", "2028-07-03T19:00:00Z", ST_JAMES, "Winner D", "Runner-up F"),

  // ------------------------------------------------------------------------
  // Quarter-finals — 6–7 July (feeders per KO_FEED, home feeder first)
  // ------------------------------------------------------------------------
  ko("qf-1", "qf", "2028-07-06T16:00:00Z", VILLA_PARK, "Winner R16-3", "Winner R16-1"),
  ko("qf-2", "qf", "2028-07-06T19:00:00Z", PRINCIPALITY, "Winner R16-5", "Winner R16-6"),
  ko("qf-3", "qf", "2028-07-07T16:00:00Z", ETIHAD, "Winner R16-7", "Winner R16-8"),
  ko("qf-4", "qf", "2028-07-07T19:00:00Z", WEMBLEY, "Winner R16-2", "Winner R16-4"),

  // ------------------------------------------------------------------------
  // Semi-finals — 11–12 July, both at Wembley
  // ------------------------------------------------------------------------
  ko("sf-1", "sf", "2028-07-11T19:00:00Z", WEMBLEY, "Winner QF-2", "Winner QF-4"),
  ko("sf-2", "sf", "2028-07-12T19:00:00Z", WEMBLEY, "Winner QF-1", "Winner QF-3"),

  // ------------------------------------------------------------------------
  // Final — 16 July, Wembley, 20:00 UK
  // ------------------------------------------------------------------------
  ko("final", "final", "2028-07-16T19:00:00Z", WEMBLEY, "Winner SF-1", "Winner SF-2"),
];
