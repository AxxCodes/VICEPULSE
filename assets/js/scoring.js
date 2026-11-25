// Scoring model shared by the website (assets/js/app.js) and the scout (scripts/).
// Keep this file dependency-free so it runs unchanged in browsers and in Node.
//
// Entry milestones form a base score. Rendering, performance and stability
// add independent points once the project shows the game world.
export const MILESTONES = [
  { key: 'groundwork', label: 'Groundwork', at: 0, desc: 'Platform, graphics and shader work before gameplay.' },
  { key: 'loads', label: 'Boots', at: 4, desc: 'The game executable starts.' },
  { key: 'boots', label: 'First frame', at: 8, desc: 'A game screen or intro renders.' },
  { key: 'menu', label: 'Menus', at: 12, desc: 'Menus render and respond to input.' },
  { key: 'world', label: 'World loads', at: 17, desc: 'The game reaches its world after the menus.' },
  { key: 'ingame', label: 'Player control', at: 25, desc: 'A player can move in a rendered gameplay scene.' },
];

export const RENDER_CHECKS = [
  { key: 'color', label: 'Colors & textures', points: 5 },
  { key: 'lighting', label: 'Lighting & shadows', points: 5 },
  { key: 'shaders', label: 'Shaders in gameplay', points: 5 },
];
const FRAME_RATE_TARGET = 30;
const SESSION_TARGET = 30;
const FRAME_RATE_WEIGHT = 35;
const SUSTAINED_WEIGHT = 10;
const SESSION_WEIGHT = 15;
const CONTROL_SCORE = MILESTONES.at(-1).at;
const RENDER_SCORE = CONTROL_SCORE + RENDER_CHECKS.reduce((sum, check) => sum + check.points, 0);
export const MAX_SCORE = RENDER_SCORE + FRAME_RATE_WEIGHT + SUSTAINED_WEIGHT + SESSION_WEIGHT;

export const READINESS_CRITERIA = [
  { key: 'control', weight: CONTROL_SCORE },
  { key: 'graphics', weight: RENDER_SCORE - CONTROL_SCORE },
  { key: 'frameRate', weight: FRAME_RATE_WEIGHT },
  { key: 'sustained', weight: SUSTAINED_WEIGHT },
  { key: 'session', weight: SESSION_WEIGHT },
];
export const RANK_RUBRIC = 'gameplay-v3';

// Reward the jump from single-digit FPS while keeping full credit at 30 FPS.
const frameRateScore = (progress) => progress ** 0.4;

// Groundwork parts and their share of the initial boot milestone.
export const GROUNDWORK = [
  { key: 'loader', label: 'Loader & system libraries', weight: 0.2, desc: 'PE loading plus stand-ins for the console-only DLLs (kernelx, xgameruntime, xmem…).' },
  { key: 'shaders', label: 'Shader translation', weight: 0.28, desc: "Share of GTA VI's ~26,500 precompiled RDNA2 shaders translated to PC formats (SPIR-V / DXIL)." },
  { key: 'graphics', label: 'Graphics layer', weight: 0.32, desc: 'Xbox D3D12.X → PC D3D12 / Vulkan: devices, command lists, pipelines, draws, present.' },
  { key: 'proven', label: 'Proven on another game', weight: 0.2, desc: 'The same layer already runs a different retail Xbox Series game (menu, in-game…).' },
];

export const STABILITY = {
  unknown: { label: 'Unknown', value: 0 },
  constant: { label: 'Crashes constantly', value: 0 },
  often: { label: 'Crashes often', value: 0.25 },
  sometimes: { label: 'Crashes sometimes', value: 0.55 },
  rarely: { label: 'Rarely crashes', value: 0.8 },
  stable: { label: 'Stable', value: 1 },
};

const LADDER = MILESTONES.slice(1);
const TICK = Object.fromEntries(MILESTONES.map((m) => [m.key, m.at]));

const clamp01 = (v) => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : 0);

// GTA ladder values are 0 (no), 0.5 (partially, e.g. "reaches the menu but it is broken") or 1 (yes).
export function ladderValue(v) {
  if (v === true) return 1;
  if (v === false || v == null) return 0;
  return clamp01(v);
}

export function groundworkFraction(gw) {
  // An effort with no public code has no groundwork to rate (the field is missing or null).
  return GROUNDWORK.reduce((sum, g) => sum + g.weight * clamp01(gw?.[g.key]), 0);
}

export function gameplaySignals(gta = {}) {
  return {
    world: ladderValue(gta.world ?? gta.ingame),
    ingame: ladderValue(gta.playable ?? (ladderValue(gta.ingame) === 1 ? 1 : 0)),
    fps: Math.max(0, Number(gta.fps) || 0),
    sustained30: gta.sustained30 === true && Number(gta.fps) >= FRAME_RATE_TARGET,
    sessionMinutes: Math.max(0, Number(gta.sessionMinutes) || 0),
  };
}

export function readinessChecks(effort) {
  const play = gameplaySignals(effort.gta);
  return {
    fps: play.fps,
    sessionMinutes: play.sessionMinutes,
    rendering: RENDER_CHECKS.map((check) => ({ ...check, progress: ladderValue(effort.visuals?.[check.key]) })),
    frameRate: clamp01(play.fps / FRAME_RATE_TARGET),
    sustained: play.sustained30 ? 1 : 0,
    session: clamp01(play.sessionMinutes / SESSION_TARGET),
  };
}

export function scoreEffort(effort) {
  const gw = groundworkFraction(effort.groundwork);
  const gta = effort.gta || {};
  const play = gameplaySignals(gta);
  const checks = readinessChecks(effort);
  let score = TICK.loads * gw;
  let reached = 'groundwork';

  for (const step of LADDER) {
    const value = ladderValue(play[step.key] ?? gta[step.key]);
    if (value < 1) {
      score += Math.max(0, step.at - score) * value;
      break;
    }
    score = step.at;
    reached = step.key;
  }

  if (play.world === 1 && (reached === 'world' || reached === 'ingame')) {
    score += checks.rendering.reduce((sum, check) => sum + check.points * check.progress, 0);
  }
  if (reached === 'ingame') {
    score += FRAME_RATE_WEIGHT * frameRateScore(checks.frameRate) + SUSTAINED_WEIGHT * checks.sustained;
    score += SESSION_WEIGHT * checks.session;
  }

  return { score: Math.round(score * 10) / 10, groundwork: gw, reached, reachedLabel: MILESTONES.find((m) => m.key === reached).label };
}

// Equal scores rank the effort with more GitHub stars first.
export const byStars = (a, b) => (b.stats?.stars || 0) - (a.stats?.stars || 0);

// The headline number: how close the leading effort is, plus the top-3 average.
export function overall(efforts) {
  const scored = efforts
    .filter((e) => !e.nuked) // taken offline: still shown on the board, no longer ranked
    .map((e) => ({ effort: e, ...scoreEffort(e) }))
    .sort((a, b) => b.score - a.score || byStars(a.effort, b.effort));
  const top = scored.slice(0, 3);
  const leader = scored[0] || null;
  const furthest = scored.reduce((best, s) => {
    const idx = MILESTONES.findIndex((m) => m.key === s.reached);
    return idx > best ? idx : best;
  }, 0);
  return {
    leader,
    score: leader ? leader.score : 0,
    top3: top.length ? Math.round((top.reduce((a, s) => a + s.score, 0) / top.length) * 10) / 10 : 0,
    furthest: MILESTONES[furthest],
    ranked: scored,
  };
}
