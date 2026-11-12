// Secret Hitler — de verhalenlaag bovenop de spelmotor: de verteller op
// het tafelscherm (korte, grappige regels per gebeurtenis), de
// claimlabels en na afloop de awards. Puur: alleen afgeleid van de
// events, de spelstaat en (na de onthulling) de rollen.

import {
  buildSecretHitlerState,
  isLieFlag,
  teamOf,
  type ShClaimFlag,
  type ShEvent,
  type ShPower,
  type ShRole,
  type ShState,
  type ShTeam,
  type ShWinReason,
} from "@/features/game-night/lib/secretHitler";

export type ShTone = "liberal" | "fascist" | "neutral" | "danger" | "win";

export type ShNarration = {
  eventId: string;
  icon: string;
  title: string;
  text: string;
  tone: ShTone;
  /** Extra regel (bv. een gevonden tegenspraak). */
  extra?: string;
};

type NameOf = (playerId: string | null | undefined) => string;

// Stabiele "willekeur": hetzelfde event geeft altijd dezelfde zin, ook na
// een herlaadbeurt of op een ander scherm.
function pick<T>(seed: string, options: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export const POWER_LABEL: Record<ShPower, string> = {
  investigate: "Partij onderzoeken",
  peek: "Stapel bekijken",
  special_election: "Speciale verkiezing",
  execute: "Executie",
};

export const POWER_ICON: Record<ShPower, string> = {
  investigate: "🔍",
  peek: "👀",
  special_election: "🗳️",
  execute: "🔫",
};

export const ROLE_LABEL: Record<ShRole, string> = {
  liberal: "Liberaal",
  fascist: "Fascist",
  hitler: "Hitler",
};

export const TEAM_LABEL: Record<ShTeam, string> = {
  liberal: "Liberalen",
  fascist: "Fascisten",
};

export const WIN_REASON_TEXT: Record<ShWinReason, string> = {
  liberal_policies: "Vijf liberale wetten aangenomen.",
  fascist_policies: "Zes fascistische wetten aangenomen.",
  hitler_elected: "Hitler werd tot kanselier gekozen.",
  hitler_executed: "Hitler werd geëxecuteerd.",
  declared: "Uitslag handmatig vastgesteld.",
};

export const WIN_REASON_SHORT: Record<ShWinReason, string> = {
  liberal_policies: "5 liberale wetten",
  fascist_policies: "6 fascistische wetten",
  hitler_elected: "Hitler gekozen",
  hitler_executed: "Hitler neergeschoten",
  declared: "handmatig",
};

export const CLAIM_FLAG_TEXT: Record<ShClaimFlag, string> = {
  conflict: "Tegenspraak: hun verhalen passen niet bij elkaar",
  chancellor_impossible: "Kanselier claimt iets wat niet kan",
  president_impossible: "President claimt iets wat niet kan",
  chancellor_chose_fascist: "Kanselier koos zelf fascistisch",
  president_discarded_liberal: "President gooide een liberale kaart weg",
};

/** "FFL", "LL" enz. voor een claim met `fascists` F in een hand van `size`. */
export function handLabel(fascists: number | null, size: number): string {
  if (fascists == null) return "—";
  return "F".repeat(fascists) + "L".repeat(Math.max(0, size - fascists));
}

const LIBERAL_LINES = [
  "Een liberale wet! De democratie ademt weer.",
  "Liberaal beleid. Ergens aan tafel balt iemand heimelijk een vuist.",
  "Blauw! Wie had dat zien aankomen?",
  "De duif vliegt. Voor even dan.",
  "Liberaal. De fascisten doen hun best om blij te kijken.",
];
const FASCIST_LINES = [
  "Fascistisch beleid. Wie keek er nou zo onschuldig?",
  "Daar gaat weer een stukje democratie.",
  "Rood. 'Ik had écht alleen maar rood, eerlijk!'",
  "Fascistisch. Tijd om iemand heel diep in de ogen te kijken.",
  "De hagedis glimlacht.",
];
const FAILED_LINES = [
  "Weggestemd! Dit duo vertrouwt niemand.",
  "Nein! Het parlement heeft er geen zin in.",
  "Afgewezen. Probeer het maar met een ander gezicht.",
];
const PASSED_LINES = [
  "Regering gekozen! Nu maar hopen.",
  "Ja! Het volk heeft gesproken.",
  "Aangenomen. Iemand heeft hier spijt van, straks.",
];
const NOT_HITLER_LINES = [
  "{c} is géén Hitler. Voorlopig ademt iedereen weer.",
  "Pfoe. {c} is niet Hitler. Of dat genoeg is...",
  "{c} is geen Hitler. Wel nog steeds verdacht natuurlijk.",
];

export function narrate(
  event: ShEvent,
  before: ShState,
  after: ShState,
  nameOf: NameOf,
): ShNarration | null {
  const p = event.payload;
  const base = { eventId: event.id };
  const president = nameOf(before.presidentId);
  switch (p.type) {
    case "start":
      return {
        ...base,
        icon: "🎩",
        title: "Het spel begint",
        text: `${nameOf(p.firstPresidentId)} is de eerste president. Ogen dicht, envelop open...`,
        tone: "neutral",
      };
    case "nominate":
      return {
        ...base,
        icon: "👉",
        title: "Kanselier voorgedragen",
        text: `${president} draagt ${nameOf(p.chancellorId)} voor. Ja of nein?`,
        tone: before.fascistPolicies >= 3 ? "danger" : "neutral",
        extra:
          before.fascistPolicies >= 3
            ? "Let op: is dit Hitler, dan winnen de fascisten."
            : undefined,
      };
    case "vote": {
      const votes = Object.values(p.votes);
      const ja = votes.filter((v) => v === "ja").length;
      const nein = votes.filter((v) => v === "nein").length;
      const tally = votes.length > 0 ? ` (${ja} ja, ${nein} nein)` : "";
      if (p.passed) {
        return {
          ...base,
          icon: "✅",
          title: "Regering gekozen" + tally,
          text: pick(event.id, PASSED_LINES),
          tone: "neutral",
        };
      }
      return {
        ...base,
        icon: "❌",
        title: "Weggestemd" + tally,
        text:
          after.phase === "chaos"
            ? "Drie keer mislukt. Het volk is het zat: CHAOS!"
            : after.electionTracker === 2
              ? "Nog één mislukte verkiezing en het land raakt in chaos!"
              : pick(event.id, FAILED_LINES),
        tone:
          after.electionTracker >= 2 || after.phase === "chaos"
            ? "danger"
            : "neutral",
      };
    }
    case "hitler_check": {
      const gov = before.governments[before.governments.length - 1];
      const c = nameOf(gov?.chancellorId);
      if (p.isHitler) {
        return {
          ...base,
          icon: "🦎",
          title: `${c} IS HITLER!`,
          text: "De fascisten grijpen de macht. Applaus voor de acteurs.",
          tone: "win",
        };
      }
      return {
        ...base,
        icon: "😮‍💨",
        title: "Geen Hitler",
        text: fill(pick(event.id, NOT_HITLER_LINES), { c }),
        tone: "neutral",
      };
    }
    case "enact": {
      const flags =
        after.governments[after.governments.length - 1]?.flags ?? [];
      const lie = flags.find(isLieFlag);
      const other = flags.find((f) => !isLieFlag(f));
      const extra = lie
        ? `🔥 ${CLAIM_FLAG_TEXT[lie]}. Eén van hen liegt!`
        : other
          ? `🤨 ${CLAIM_FLAG_TEXT[other]}.`
          : undefined;
      if (after.phase === "game_over") {
        return {
          ...base,
          icon: p.policy === "L" ? "🕊️" : "💀",
          title:
            p.policy === "L"
              ? "Vijfde liberale wet!"
              : "Zesde fascistische wet!",
          text:
            p.policy === "L"
              ? "De liberalen winnen. De democratie is gered!"
              : "De fascisten winnen. Het was mooi zolang het duurde.",
          tone: "win",
          extra,
        };
      }
      const milestone =
        p.policy === "F" && after.fascistPolicies === 3
          ? "Vanaf nu: wordt Hitler kanselier, dan winnen de fascisten."
          : p.policy === "F" && after.fascistPolicies === 5
            ? "Vetorecht ontgrendeld. En nog één rode..."
            : p.policy === "L" && after.liberalPolicies === 4
              ? "Nog één liberale wet voor de overwinning!"
              : null;
      return {
        ...base,
        icon: p.policy === "L" ? "🕊️" : "💀",
        title: p.policy === "L" ? "Liberale wet" : "Fascistische wet",
        text:
          milestone ??
          pick(event.id, p.policy === "L" ? LIBERAL_LINES : FASCIST_LINES),
        tone: p.policy === "L" ? "liberal" : "fascist",
        extra,
      };
    }
    case "veto":
      return {
        ...base,
        icon: "✋",
        title: "Veto!",
        text: "Beide kaarten de prullenbak in. De verkiezingsteller tikt door.",
        tone: "danger",
      };
    case "chaos":
      return {
        ...base,
        icon: "🌪️",
        title: "Chaos!",
        text: `De bovenste kaart wordt wet: ${p.policy === "L" ? "liberaal" : "fascistisch"}. Termijnlimieten vervallen.`,
        tone:
          after.phase === "game_over"
            ? "win"
            : p.policy === "L"
              ? "liberal"
              : "fascist",
      };
    case "investigate":
      return {
        ...base,
        icon: "🔍",
        title: "Onderzoek",
        text:
          p.claim == null
            ? `${president} bekijkt de partijkaart van ${nameOf(p.targetId)}. En zwijgt.`
            : `${president} bekijkt ${nameOf(p.targetId)} en zegt: ${p.claim === "liberal" ? "liberaal" : "FASCIST"}!`,
        tone: p.claim === "fascist" ? "danger" : "neutral",
      };
    case "peek":
      return {
        ...base,
        icon: "👀",
        title: "Stapel bekeken",
        text:
          p.claim == null
            ? `${president} gluurt naar de bovenste drie kaarten.`
            : `${president} zag ${handLabel(p.claim, 3)} bovenop de stapel. Zegt-ie.`,
        tone: "neutral",
      };
    case "special_election":
      return {
        ...base,
        icon: "🗳️",
        title: "Speciale verkiezing",
        text: `${president} wijst ${nameOf(p.targetId)} aan als volgende president.`,
        tone: "neutral",
      };
    case "execute":
      if (p.wasHitler) {
        return {
          ...base,
          icon: "🎯",
          title: `${nameOf(p.targetId)} was Hitler!`,
          text: `${president} schoot raak. De liberalen winnen!`,
          tone: "win",
        };
      }
      return {
        ...base,
        icon: "🔫",
        title: "Executie",
        text: `${president} schiet ${nameOf(p.targetId)} neer. Geen Hitler... ${nameOf(p.targetId)} mag vanaf nu alleen nog boos kijken.`,
        tone: "danger",
      };
    case "quote":
      return {
        ...base,
        icon: "💬",
        title: p.playerId ? `${nameOf(p.playerId)} zei:` : "Quote van de avond",
        text: `“${p.text}”`,
        tone: "neutral",
      };
    case "declare_winner":
      return {
        ...base,
        icon: "🏁",
        title: `${TEAM_LABEL[p.winner]} winnen`,
        text: "Uitslag handmatig vastgesteld.",
        tone: "win",
      };
    case "reveal":
      return {
        ...base,
        icon: "🎭",
        title: "De maskers af!",
        text: "Alle rollen zijn onthuld.",
        tone: "win",
      };
  }
}

/** Alle vertellingen in volgorde (nieuwste laatst). */
export function buildStory(
  seats: string[],
  events: ShEvent[],
  nameOf: NameOf,
): ShNarration[] {
  const active = events
    .filter((e) => e.undone_at == null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out: ShNarration[] = [];
  let before = buildSecretHitlerState(seats, []);
  for (let i = 0; i < active.length; i++) {
    const after = buildSecretHitlerState(seats, active.slice(0, i + 1));
    if (!after.ignoredEventIds.includes(active[i].id)) {
      const line = narrate(active[i], before, after, nameOf);
      if (line) out.push(line);
    }
    before = after;
  }
  return out;
}

// ── Awards ─────────────────────────────────────────────────────────────

export type ShAward = {
  id: string;
  icon: string;
  title: string;
  playerIds: string[];
  text: string;
};

export type ShSuspicion = { voterId: string; suspectId: string };

function topBy(
  counts: Map<string, number>,
  min = 1,
): { ids: string[]; count: number } {
  let best = 0;
  for (const v of counts.values()) best = Math.max(best, v);
  if (best < min) return { ids: [], count: 0 };
  return {
    ids: [...counts.entries()].filter(([, v]) => v === best).map(([k]) => k),
    count: best,
  };
}

function inc(map: Map<string, number>, id: string, by = 1) {
  map.set(id, (map.get(id) ?? 0) + by);
}

function names(ids: string[], nameOf: NameOf): string {
  const list = ids.map((id) => nameOf(id));
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} en ${list[list.length - 1]}`;
}

export function buildAwards(
  state: ShState,
  nameOf: NameOf,
  suspicions: ShSuspicion[] = [],
): ShAward[] {
  const roles = state.roles;
  if (!roles) return [];
  const team = (id: string): ShTeam | null =>
    roles[id] ? teamOf(roles[id]) : null;
  const awards: ShAward[] = [];
  const elected = state.governments.filter((g) => g.passed);

  // 🎭 Beste acteur: fascist(isch team) met de meeste ja-stemmen van
  // liberalen voor regeringen waar hij/zij in zat.
  const actor = new Map<string, number>();
  for (const g of elected) {
    for (const member of [g.presidentId, g.chancellorId]) {
      if (team(member) !== "fascist") continue;
      for (const [voter, v] of Object.entries(g.votes)) {
        if (v === "ja" && team(voter) === "liberal") inc(actor, member);
      }
    }
  }
  const bestActor = topBy(actor, 2);
  if (bestActor.ids.length > 0) {
    awards.push({
      id: "actor",
      icon: "🎭",
      title: "Oscar voor beste acteur",
      playerIds: bestActor.ids,
      text: `${names(bestActor.ids, nameOf)} kreeg ${bestActor.count} ja-stemmen van nietsvermoedende liberalen.`,
    });
  }

  // 🐑 Naïefste schaap: liberaal die het vaakst ja stemde op een regering
  // met een fascist erin.
  const sheep = new Map<string, number>();
  for (const g of state.governments) {
    const fascistInside =
      team(g.presidentId) === "fascist" || team(g.chancellorId) === "fascist";
    if (!fascistInside) continue;
    for (const [voter, v] of Object.entries(g.votes)) {
      if (v === "ja" && team(voter) === "liberal") inc(sheep, voter);
    }
  }
  const sheepTop = topBy(sheep, 2);
  if (sheepTop.ids.length > 0) {
    awards.push({
      id: "sheep",
      icon: "🐑",
      title: "Naïefste schaap",
      playerIds: sheepTop.ids,
      text: `Stemde ${sheepTop.count}× ja op een regering met een fascist erin. Mèèh.`,
    });
  }

  // 🦎 Hitlers beste vriend: liberaal die Hitler voordroeg of ja stemde
  // op Hitler als kanselier.
  const hitlerId = Object.entries(roles).find(([, r]) => r === "hitler")?.[0];
  if (hitlerId) {
    const friend = new Map<string, number>();
    for (const g of state.governments) {
      if (g.chancellorId !== hitlerId) continue;
      if (team(g.presidentId) === "liberal") inc(friend, g.presidentId, 2);
      for (const [voter, v] of Object.entries(g.votes)) {
        if (v === "ja" && team(voter) === "liberal") inc(friend, voter);
      }
    }
    const friendTop = topBy(friend, 1);
    if (friendTop.ids.length > 0) {
      awards.push({
        id: "hitler-friend",
        icon: "🦎",
        title: "Hitlers beste vriend",
        playerIds: friendTop.ids,
        text: `Hielp ${nameOf(hitlerId)} een handje richting de kanselarij. Oeps.`,
      });
    }
  }

  // 🤥 Leugenaar ontmaskerd: fascistisch teamlid in een regering met
  // tegenstrijdige claims.
  const liars = new Set<string>();
  for (const g of elected) {
    if (!g.flags.some(isLieFlag)) continue;
    for (const member of [g.presidentId, g.chancellorId]) {
      if (team(member) === "fascist") liars.add(member);
    }
  }
  if (liars.size > 0) {
    awards.push({
      id: "liar",
      icon: "🤥",
      title: "Leugenaar ontmaskerd",
      playerIds: [...liars],
      text: `${names([...liars], nameOf)} vertelde een verhaal dat niet klopte. Nu weten we waarom.`,
    });
  }

  // 🔫 Eigen doelpunt / 🎯 Scherpschutter
  for (const g of elected) {
    if (g.power?.power !== "execute") continue;
    const shooter = g.presidentId;
    const victim = g.power.targetId;
    if (team(shooter) === "liberal" && team(victim) === "liberal") {
      awards.push({
        id: `own-goal-${g.index}`,
        icon: "🙈",
        title: "Eigen doelpunt",
        playerIds: [shooter],
        text: `${nameOf(shooter)} schoot medeliberaal ${nameOf(victim)} neer.`,
      });
    } else if (team(shooter) === "liberal" && team(victim) === "fascist") {
      awards.push({
        id: `sharpshooter-${g.index}`,
        icon: "🎯",
        title: "Scherpschutter",
        playerIds: [shooter],
        text: `${nameOf(shooter)} schakelde ${ROLE_LABEL[roles[victim]].toLowerCase()} ${nameOf(victim)} uit.`,
      });
    } else if (team(shooter) === "fascist" && team(victim) === "fascist") {
      awards.push({
        id: `traitor-${g.index}`,
        icon: "🗡️",
        title: "Broedermoord",
        playerIds: [shooter],
        text: `${nameOf(shooter)} offerde partijgenoot ${nameOf(victim)} op voor de geloofwaardigheid.`,
      });
    }
  }

  // 🙅 Neezegger
  const nein = new Map<string, number>();
  for (const g of state.governments) {
    for (const [voter, v] of Object.entries(g.votes)) {
      if (v === "nein") inc(nein, voter);
    }
  }
  const neinTop = topBy(nein, 3);
  if (neinTop.ids.length > 0 && neinTop.ids.length <= 2) {
    awards.push({
      id: "nein",
      icon: "🙅",
      title: "Neezegger",
      playerIds: neinTop.ids,
      text: `${neinTop.count}× nein. Vertrouwt werkelijk niemand.`,
    });
  }

  // 👑 Machtswellusteling: vaakst in een gekozen regering.
  const power = new Map<string, number>();
  for (const g of elected) {
    inc(power, g.presidentId);
    inc(power, g.chancellorId);
  }
  const powerTop = topBy(power, 3);
  if (powerTop.ids.length > 0 && powerTop.ids.length <= 2) {
    awards.push({
      id: "power",
      icon: "👑",
      title: "Machtswellusteling",
      playerIds: powerTop.ids,
      text: `Zat ${powerTop.count}× in de regering.`,
    });
  }

  // Telefoons: wie verdacht wie?
  if (suspicions.length > 0 && hitlerId) {
    const sherlocks = suspicions
      .filter((s) => s.suspectId === hitlerId && s.voterId !== hitlerId)
      .map((s) => s.voterId);
    if (sherlocks.length > 0) {
      awards.push({
        id: "sherlock",
        icon: "🕵️",
        title: "Sherlock",
        playerIds: sherlocks,
        text: `Had ${nameOf(hitlerId)} door. Op de telefoon staat het zwart op wit.`,
      });
    }
    const suspected = new Map<string, number>();
    for (const s of suspicions) {
      if (team(s.suspectId) === "liberal") inc(suspected, s.suspectId);
    }
    const victim = topBy(suspected, 2);
    if (victim.ids.length === 1) {
      awards.push({
        id: "wrongly-accused",
        icon: "😇",
        title: "Onterecht verdacht",
        playerIds: victim.ids,
        text: `${victim.count} mensen dachten dat ${nameOf(victim.ids[0])} Hitler was. Gewoon liberaal, dus.`,
      });
    }
  }

  // 🦎 Meesterbrein: Hitler die ongeschonden won.
  if (
    hitlerId &&
    state.winner === "fascist" &&
    !state.dead.includes(hitlerId)
  ) {
    awards.push({
      id: "mastermind",
      icon: "🧠",
      title: "Meesterbrein",
      playerIds: [hitlerId],
      text:
        state.winReason === "hitler_elected"
          ? `${nameOf(hitlerId)} liet zich gewoon tot kanselier kiezen. Ongelofelijk.`
          : `${nameOf(hitlerId)} bleef de hele avond buiten schot.`,
    });
  }

  return awards;
}

/** Korte teamtekst voor in de geschiedenis/statistieken. */
export function roleIcon(role: ShRole): string {
  return role === "liberal" ? "🕊️" : role === "fascist" ? "💀" : "🦎";
}

// ── Statistieken over alle potjes (spelpagina) ─────────────────────────

export type ShCareer = {
  playerId: string;
  played: number;
  liberal: number;
  fascist: number;
  hitler: number;
  wins: number;
  liberalWins: number;
  fascistWins: number;
  hitlerWins: number;
  executed: number;
  hitlersShot: number;
  lies: number;
  elected: number;
};

export type ShCareerSummary = {
  games: number;
  liberalWins: number;
  fascistWins: number;
  reasons: Partial<Record<ShWinReason, number>>;
  players: ShCareer[];
};

export function buildSecretHitlerCareer(
  games: { seats: string[]; events: ShEvent[] }[],
): ShCareerSummary {
  const players = new Map<string, ShCareer>();
  const get = (id: string): ShCareer => {
    let c = players.get(id);
    if (!c) {
      c = {
        playerId: id,
        played: 0,
        liberal: 0,
        fascist: 0,
        hitler: 0,
        wins: 0,
        liberalWins: 0,
        fascistWins: 0,
        hitlerWins: 0,
        executed: 0,
        hitlersShot: 0,
        lies: 0,
        elected: 0,
      };
      players.set(id, c);
    }
    return c;
  };
  const summary: ShCareerSummary = {
    games: 0,
    liberalWins: 0,
    fascistWins: 0,
    reasons: {},
    players: [],
  };

  for (const game of games) {
    const state = buildSecretHitlerState(game.seats, game.events);
    if (!state.winner || !state.roles) continue;
    const roles = state.roles;
    summary.games += 1;
    if (state.winner === "liberal") summary.liberalWins += 1;
    else summary.fascistWins += 1;
    if (state.winReason)
      summary.reasons[state.winReason] =
        (summary.reasons[state.winReason] ?? 0) + 1;

    for (const id of state.seats) {
      const role = roles[id];
      if (!role) continue;
      const c = get(id);
      c.played += 1;
      c[role] += 1;
      if (teamOf(role) === state.winner) {
        c.wins += 1;
        if (role === "liberal") c.liberalWins += 1;
        else if (role === "fascist") c.fascistWins += 1;
        else c.hitlerWins += 1;
      }
      if (state.dead.includes(id)) c.executed += 1;
    }
    for (const g of state.governments) {
      if (g.passed) {
        get(g.presidentId).elected += 1;
        get(g.chancellorId).elected += 1;
      }
      if (g.flags.some(isLieFlag)) {
        for (const id of [g.presidentId, g.chancellorId]) {
          if (roles[id] && teamOf(roles[id]) === "fascist") get(id).lies += 1;
        }
      }
      if (g.power?.power === "execute" && g.power.wasHitler) {
        get(g.presidentId).hitlersShot += 1;
      }
    }
  }
  summary.players = [...players.values()]
    .filter((p) => p.played > 0)
    .sort((a, b) => b.wins - a.wins || b.played - a.played);
  return summary;
}
