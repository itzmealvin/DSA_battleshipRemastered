import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  createFleet,
  fire,
  startGame,
  generateIslands,
  chooseBotTarget,
  probabilityMap,
} from "../src/game.js";

function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
test("fleets fit straight ships without overlaps or island collisions", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rng = seeded(seed);
    const islands = generateIslands(25, rng);
    const fleet = createFleet(islands, rng);
    assert.deepEqual(
      fleet.ships.map((s) => s.cells.length),
      [5, 4, 3, 3, 2],
    );
    const cells = fleet.ships.flatMap((s) => s.cells);
    assert.equal(new Set(cells).size, 17);
    assert.ok(cells.every((c) => c >= 0 && c < 100 && !islands.includes(c)));
    for (const ship of fleet.ships) {
      const step = ship.cells[1] - ship.cells[0];
      assert.ok(step === 1 || step === 10);
      assert.ok(ship.cells.every((c, i) => c === ship.cells[0] + i * step));
      if (step === 1)
        assert.equal(
          Math.floor(ship.cells[0] / 10),
          Math.floor(ship.cells.at(-1) / 10),
        );
    }
  }
});
test("island generation terminates even with a constant random source", () => {
  for (const count of [0, 1, 25])
    assert.equal(new Set(generateIslands(count, () => 0)).size, count);
  for (const count of [-1, 26, 1.5])
    assert.throws(() => generateIslands(count), RangeError);
});
test("hits count as shots and keep the turn; misses change the turn", () => {
  const game = createGame({ rng: seeded(4) });
  startGame(game);
  assert.equal(fire(game, game.fleets[1].ships[0].cells[0]).hit, true);
  assert.equal(game.turn, 0);
  assert.equal(game.shots[0].size, 1);
  const miss = Array.from({ length: 100 }, (_, i) => i).find(
    (c) => !game.fleets[1].ships.some((s) => s.cells.includes(c)),
  );
  assert.equal(fire(game, miss).hit, false);
  assert.equal(game.turn, 1);
});
test("invalid, setup, duplicate, island and post-victory shots do not change state", () => {
  const game = createGame({ islandCount: 10, rng: seeded(7) });
  assert.equal(fire(game, 0).valid, false);
  startGame(game);
  for (const c of [-1, 100, 1.5, NaN, "5", ...game.islands])
    assert.equal(fire(game, c).valid, false);
  const first = game.fleets[1].ships[0].cells[0];
  fire(game, first);
  assert.equal(fire(game, first).valid, false);
  for (const c of game.fleets[1].ships
    .flatMap((s) => s.cells)
    .filter((c) => c !== first))
    fire(game, c);
  assert.equal(game.winner, 0);
  assert.equal(game.phase, "finished");
  assert.equal(fire(game, 99).valid, false);
  assert.equal(game.shots[0].size, 17);
});
test("bot selects unique legal targets using only public information", () => {
  const islands = generateIslands(25, seeded(2));
  const shots = new Map();
  for (let i = 0; i < 75; i++) {
    const c = chooseBotTarget(shots, islands, () => 0);
    assert.ok(!shots.has(c) && !islands.includes(c));
    shots.set(c, { hit: false });
  }
  assert.equal(chooseBotTarget(shots, islands), null);
  const scores = probabilityMap(
    new Map([
      [44, { hit: true }],
      [45, { hit: true }],
    ]),
    [],
  );
  assert.equal(scores[44], 0);
  assert.ok(scores[46] > scores[34]);
});
test("full bot matches always terminate with one winner and no repeated shots", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = seeded(seed);
    const game = createGame({ islandCount: 25, rng });
    startGame(game);
    let moves = 0;
    while (game.phase === "playing" && moves++ < 200) {
      assert.equal(
        fire(game, chooseBotTarget(game.shots[game.turn], game.islands, rng))
          .valid,
        true,
      );
    }
    assert.equal(game.phase, "finished");
    assert.ok(game.winner === 0 || game.winner === 1);
  }
});
