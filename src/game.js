export const SHIPS = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 },
];

const allCells = () => Array.from({ length: 100 }, (_, i) => i);
const neighbors = (c) =>
  [
    c - 10,
    c + 10,
    ...(c % 10 ? [c - 1] : []),
    ...(c % 10 < 9 ? [c + 1] : []),
  ].filter((n) => n >= 0 && n < 100);

function shuffle(items, rng) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function placements(size) {
  const result = [];
  for (const c of allCells()) {
    if ((c % 10) + size <= 10)
      result.push(Array.from({ length: size }, (_, i) => c + i));
    if (Math.floor(c / 10) + size <= 10)
      result.push(Array.from({ length: size }, (_, i) => c + i * 10));
  }
  return result;
}

export function generateIslands(count = 0, rng = Math.random) {
  if (!Number.isInteger(count) || count < 0 || count > 25) {
    throw new RangeError("Choose 0–25 island cells.");
  }
  if (!count) return [];
  const visited = new Set();
  const stack = [Math.floor(rng() * 100)];
  while (visited.size < count && stack.length) {
    const cell = stack.pop();
    if (visited.has(cell)) continue;
    visited.add(cell);
    stack.push(
      ...shuffle(
        neighbors(cell).filter((c) => !visited.has(c)),
        rng,
      ),
    );
  }
  return [...visited];
}

export function createFleet(islands = [], rng = Math.random) {
  const occupied = new Set(islands);
  const ships = [];
  // Finite candidate search replaces unbounded random retry loops.
  function place(index) {
    if (index === SHIPS.length) return true;
    for (const cells of shuffle(placements(SHIPS[index].size), rng)) {
      if (cells.some((c) => occupied.has(c))) continue;
      cells.forEach((c) => occupied.add(c));
      ships.push({ ...SHIPS[index], cells });
      if (place(index + 1)) return true;
      ships.pop();
      cells.forEach((c) => occupied.delete(c));
    }
    return false;
  }
  if (!place(0)) throw new Error("No fleet fits this map. Generate a new map.");
  return { ships };
}

export function createGame({
  mode = "solo",
  islandCount = 0,
  rng = Math.random,
} = {}) {
  if (mode !== "solo" && mode !== "local") {
    throw new RangeError('Mode must be "solo" or "local".');
  }
  const islands = generateIslands(islandCount, rng);
  return {
    mode,
    islands,
    fleets: [createFleet(islands, rng), createFleet(islands, rng)],
    shots: [new Map(), new Map()],
    turn: 0,
    phase: "setup",
    winner: null,
  };
}

export function startGame(game) {
  if (game && game.phase === "setup") game.phase = "playing";
}

export function fire(game, cell) {
  if (
    !game ||
    game.phase !== "playing" ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell > 99
  ) {
    return { valid: false };
  }
  const attacker = game.turn;
  const shots = game.shots[attacker];
  if (game.islands.includes(cell) || shots.has(cell)) return { valid: false };

  const fleet = game.fleets[1 - attacker];
  const ship = fleet.ships.find((s) => s.cells.includes(cell));
  const result = {
    valid: true,
    cell,
    attacker,
    hit: Boolean(ship),
    sunk: null,
  };
  shots.set(cell, result);

  if (ship && ship.cells.every((c) => shots.has(c))) {
    result.sunk = ship.name;
    ship.cells.forEach((c) => {
      shots.get(c).sunk = ship.name;
    });
  }

  if (fleet.ships.every((s) => s.cells.every((c) => shots.has(c)))) {
    game.winner = attacker;
    game.phase = "finished";
  } else if (!ship) {
    game.turn = 1 - attacker;
  }
  return result;
}

// Only public shot results and terrain enter the targeting algorithm.
export function probabilityMap(
  shots,
  islands,
  sizes = SHIPS.map((s) => s.size),
) {
  const scores = Array(100).fill(0);
  const blocked = new Set([
    ...islands,
    ...[...shots].filter(([, s]) => !s.hit || s.sunk).map(([c]) => c),
  ]);
  const hitSet = new Set(
    [...shots].filter(([, s]) => s.hit && !s.sunk).map(([c]) => c),
  );
  const sunkNames = new Set(
    [...shots.values()].map((s) => s.sunk).filter(Boolean),
  );
  const remaining = sizes.slice();

  for (const name of sunkNames) {
    const size = SHIPS.find((s) => s.name === name)?.size;
    const index = remaining.indexOf(size);
    if (index >= 0) remaining.splice(index, 1);
  }

  for (const size of remaining) {
    for (const cells of placements(size)) {
      if (cells.some((c) => blocked.has(c))) continue;
      let hitOverlap = 0;
      for (const c of cells) if (hitSet.has(c)) hitOverlap++;
      // Exponential scaling by hitOverlap prioritizes collinear multi-hit lines over single-hit perpendiculars.
      const weight = hitOverlap > 0 ? 100 ** hitOverlap : 1;
      for (const c of cells) {
        if (!shots.has(c)) scores[c] += weight;
      }
    }
  }
  return scores;
}

export function chooseBotTarget(shots, islands, rng = Math.random) {
  const scores = probabilityMap(shots, islands);
  const islandSet = new Set(islands);
  const candidates = allCells().filter(
    (c) => !shots.has(c) && !islandSet.has(c),
  );
  if (!candidates.length) return null;
  const max = Math.max(...candidates.map((c) => scores[c]));
  const best = candidates.filter((c) => scores[c] === max);
  return best[Math.floor(rng() * best.length)];
}
