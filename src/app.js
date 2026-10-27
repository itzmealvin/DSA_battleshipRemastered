import {
  SHIPS,
  createGame,
  createFleet,
  startGame,
  fire,
  chooseBotTarget,
  probabilityMap,
} from "./game.js";

const $ = (id) => document.getElementById(id);
let game;
let setupPlayer = 0;
let viewer = 0;
let botTimer;
let handoffAction;
let targetFocus = 0;
let history = [];
let saved = { wins: 0, losses: 0 };

try {
  const data = JSON.parse(localStorage.getItem("battleship-record"));
  if (
    data &&
    Number.isSafeInteger(data.wins) &&
    data.wins >= 0 &&
    Number.isSafeInteger(data.losses) &&
    data.losses >= 0
  ) {
    saved = data;
  }
} catch {
  /* Storage may be unavailable; the match remains playable. */
}

const coord = (c) =>
  `${String.fromCharCode(65 + Math.floor(c / 10))}${(c % 10) + 1}`;
const playerName = (p) =>
  game.mode === "solo" ? (p === 0 ? "You" : "Computer") : `Player ${p + 1}`;
const afloat = (p) =>
  game.fleets[p].ships.filter(
    (s) => !s.cells.every((c) => game.shots[1 - p].has(c)),
  ).length;

function announce(message) {
  $("announcement").textContent = message;
}

function newMatch({ focusSetup = false } = {}) {
  clearTimeout(botTimer);
  setupPlayer = 0;
  viewer = 0;
  history = [];
  targetFocus = 0;
  game = createGame({
    mode: $("mode").value,
    islandCount: Number($("islands").value),
  });
  $("lens").checked = false;
  if ($("handoff-dialog").open) $("handoff-dialog").close();
  document.querySelector(".workspace").style.visibility = "visible";
  announce("Your ships are in position. The ocean is waiting.");
  render();
  if (focusSetup) $("shuffle").focus();
}

function handoff(player, action) {
  clearTimeout(botTimer);
  $("lens").checked = false;
  $("handoff-title").textContent = `Pass to Player ${player + 1}`;
  $("handoff-copy").textContent =
    game.phase === "setup"
      ? "Hand over the device so the next commander can plot their fleet."
      : "Hand over the device before revealing the next station.";
  handoffAction = action;
  document.querySelector(".workspace").style.visibility = "hidden";
  $("handoff-dialog").showModal();
}

function renderBoard(id, owner, reveal) {
  const board = $(id);
  const shots = game.shots[1 - owner];
  const interactive = id === "target-board";
  const focused = board.contains(document.activeElement);
  const scores =
    interactive && $("lens").checked && game.phase !== "setup"
      ? probabilityMap(shots, game.islands)
      : null;
  const peak = scores ? Math.max(1, ...scores) : 1;
  const fragment = document.createDocumentFragment();

  const label = (text) => {
    const el = document.createElement("span");
    el.className = "coordinate";
    el.textContent = text;
    el.setAttribute("aria-hidden", "true");
    fragment.append(el);
  };

  label("");
  for (let i = 1; i <= 10; i++) label(i);

  for (let row = 0; row < 10; row++) {
    label(String.fromCharCode(65 + row));
    for (let col = 0; col < 10; col++) {
      const c = row * 10 + col;
      const ship = game.fleets[owner].ships.find((s) => s.cells.includes(c));
      const shot = shots.get(c);
      const island = game.islands.includes(c);
      const cell = document.createElement(interactive ? "button" : "span");
      cell.className = "cell";
      cell.dataset.cell = c;
      let description = "uncharted water";

      if (island) {
        cell.classList.add("island");
        description = "charted shoal";
      } else if (shot) {
        cell.classList.add(shot.hit ? "hit" : "miss");
        if (shot.sunk) cell.classList.add("sunk");
        cell.textContent = shot.hit ? "×" : "•";
        description = shot.sunk
          ? `${shot.sunk} sunk`
          : shot.hit
            ? "hit"
            : "miss";
      } else if (reveal && ship) {
        cell.classList.add("ship");
        description = ship.name;
      } else if (scores && scores[c]) {
        cell.classList.add("likely");
        cell.style.setProperty("--heat", (scores[c] / peak).toFixed(3));
      }

      if (scores && !shot && !island) {
        description += `, relative likelihood ${Math.round((scores[c] / peak) * 100)} percent`;
      }
      cell.setAttribute("aria-label", `${coord(c)}: ${description}`);
      if (interactive) {
        cell.type = "button";
        cell.tabIndex = c === targetFocus ? 0 : -1;
        cell.setAttribute(
          "aria-disabled",
          String(
            game.phase !== "playing" ||
              (game.mode === "solo" && game.turn === 1) ||
              Boolean(shot) ||
              island,
          ),
        );
      } else {
        cell.setAttribute("role", "img");
      }
      fragment.append(cell);
    }
  }
  board.replaceChildren(fragment);
  if (focused)
    board
      .querySelector(`[data-cell="${targetFocus}"]`)
      ?.focus({ preventScroll: true });
}

function renderManifest(viewerIndex) {
  const viewerShots = game.shots[viewerIndex];
  const sunkNames = new Set(
    [...viewerShots.values()].map((s) => s.sunk).filter(Boolean),
  );
  const remainingCells =
    17 - [...viewerShots.values()].filter((shot) => shot.hit).length;
  $("manifest-caption").textContent =
    game.phase === "setup" ? "17 ship cells" : `${remainingCells} cells intact`;

  $("fleet-list").innerHTML = SHIPS.map((s) => {
    const isSunk = game.phase !== "setup" && sunkNames.has(s.name);
    const statusText = isSunk ? "sunk" : "afloat";
    return `<li class="${isSunk ? "is-sunk" : ""}">
      <span class="vessel-name">${s.name}</span>
      <span class="ship-pips" role="img" aria-label="${s.size} cells, ${statusText}">${'<i aria-hidden="true"></i>'.repeat(s.size)}</span>
    </li>`;
  }).join("");
}

function render() {
  document.body.dataset.phase = game.phase;
  document.body.dataset.turn = String(game.turn);
  const setup = game.phase === "setup";
  const finished = game.phase === "finished";
  viewer = setup ? setupPlayer : game.mode === "solo" ? 0 : game.turn;

  $("settings").disabled = !setup || setupPlayer !== 0;
  $("shuffle").hidden = !setup;
  $("launch").hidden = !setup;
  $("new-game").hidden = setup;

  $("setup-help").textContent = setup
    ? "Your fleet is ready. Shuffle to change its formation, then deploy."
    : finished
      ? "The battle is over. Start a new match to play again."
      : "Select a coordinate in enemy waters. A hit earns another shot.";

  $("phase-label").textContent = setup
    ? game.mode === "local"
      ? `Player ${setupPlayer + 1}, deploy your fleet`
      : "Ready to deploy"
    : finished
      ? `${playerName(game.winner)} ${game.winner === 0 && game.mode === "solo" ? "win" : "wins"}!`
      : game.mode === "solo"
        ? game.turn === 0
          ? "Your turn"
          : "Computer is plotting…"
        : `Player ${game.turn + 1}’s turn`;

  const totalShots = game.shots[viewer].size;
  const totalHits = [...game.shots[viewer].values()].filter(
    (s) => s.hit,
  ).length;
  $("turn-label").textContent = setup
    ? "You have the first shot"
    : `${totalShots} shots fired (${totalHits} hits)`;

  $("own-title").textContent =
    game.mode === "solo" ? "Your fleet" : `Player ${viewer + 1}’s fleet`;
  $("target-title").textContent =
    game.mode === "solo" ? "Enemy fleet" : `Player ${2 - viewer}’s waters`;
  $("own-count").textContent = `${afloat(viewer)} afloat`;
  $("enemy-count").textContent = `${afloat(1 - viewer)} afloat`;
  $("target-detail").textContent = setup
    ? "Deploy to begin"
    : finished
      ? "Engagement complete"
      : game.mode === "solo" && game.turn === 1
        ? "Waiting for your opponent"
        : "Select a target coordinate";
  $("own-detail").textContent = setup
    ? "Keep your formation secret"
    : "Defend all five ships";
  $("lens").disabled = setup;

  renderManifest(viewer);
  $("record").textContent = `${saved.wins} wins / ${saved.losses} losses`;
  $("shot-log").replaceChildren(
    ...history
      .slice(-4)
      .reverse()
      .map((item) => {
        const li = document.createElement("li");
        li.textContent = item.text;
        if (item.hit) li.className = "hit-entry";
        return li;
      }),
  );

  renderBoard("own-board", viewer, true);
  renderBoard("target-board", 1 - viewer, finished);
}

function recordVictory() {
  if (game.mode !== "solo") return;
  saved[game.winner === 0 ? "wins" : "losses"]++;
  try {
    localStorage.setItem("battleship-record", JSON.stringify(saved));
  } catch {
    /* In-memory record is still available. */
  }
}

function takeShot(cell) {
  const result = fire(game, cell);
  if (!result.valid) return;
  const text = `${playerName(result.attacker)}: ${coord(cell)}, ${
    result.sunk ? `${result.sunk} sunk` : result.hit ? "hit" : "miss"
  }.`;
  history.push({ text, hit: result.hit });

  const endSuffix =
    game.mode === "solo"
      ? game.winner === 0
        ? " The enemy fleet is sunk. Battle complete."
        : " Your fleet has been sunk. Battle complete."
      : ` ${playerName(game.winner)} wins the battle.`;

  announce(
    text +
      (game.phase === "finished"
        ? endSuffix
        : result.hit
          ? " Fire again."
          : " Turn passed."),
  );

  if (game.phase === "finished") recordVictory();
  if (
    game.mode === "local" &&
    game.phase === "playing" &&
    game.turn !== result.attacker
  ) {
    handoff(game.turn, render);
    return;
  }
  render();
  queueBot();
}

function queueBot() {
  clearTimeout(botTimer);
  if (game.mode !== "solo" || game.phase !== "playing" || game.turn !== 1)
    return;
  botTimer = setTimeout(() => {
    const cell = chooseBotTarget(game.shots[1], game.islands);
    if (cell !== null) takeShot(cell);
  }, 650);
}

$("shuffle").addEventListener("click", () => {
  game.fleets[setupPlayer] = createFleet(game.islands);
  announce("Fleet shuffled. Deploy when you are ready.");
  render();
});

$("launch").addEventListener("click", () => {
  if (game.mode === "local" && setupPlayer === 0) {
    setupPlayer = 1;
    handoff(1, render);
  } else {
    startGame(game);
    announce("Fleet deployed. Select a coordinate in enemy waters.");
    if (game.mode === "local") {
      handoff(0, render);
    } else {
      render();
      $("target-board")
        .querySelector(`[data-cell="${targetFocus}"]`)
        ?.focus({ preventScroll: true });
    }
  }
});

$("mode").addEventListener("change", () => newMatch());
$("islands").addEventListener("change", () => newMatch());
$("lens").addEventListener("change", render);

$("target-board").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cell]");
  if (!button) return;
  targetFocus = Number(button.dataset.cell);
  if (button.getAttribute("aria-disabled") === "false") takeShot(targetFocus);
});

$("target-board").addEventListener("keydown", (event) => {
  const c = Number(event.target.dataset.cell);
  if (!Number.isInteger(c)) return;
  const moves = {
    ArrowLeft: c % 10 ? c - 1 : c,
    ArrowRight: c % 10 < 9 ? c + 1 : c,
    ArrowUp: c >= 10 ? c - 10 : c,
    ArrowDown: c < 90 ? c + 10 : c,
    Home: c - (c % 10),
    End: c - (c % 10) + 9,
    PageUp: c % 10,
    PageDown: 90 + (c % 10),
  };
  if (!(event.key in moves)) return;
  event.preventDefault();
  targetFocus = moves[event.key];
  for (const button of $("target-board").querySelectorAll("button")) {
    button.tabIndex = Number(button.dataset.cell) === targetFocus ? 0 : -1;
  }
  $("target-board").querySelector(`[data-cell="${targetFocus}"]`)?.focus();
});

$("how-to").addEventListener("click", () => $("help-dialog").showModal());
$("stats").addEventListener("click", () => {
  $("stats-content").textContent =
    `${saved.wins} wins and ${saved.losses} losses across ${
      saved.wins + saved.losses
    } completed matches.`;
  $("stats-dialog").showModal();
});

$("new-game").addEventListener("click", () => {
  if (game.phase === "finished") newMatch({ focusSetup: true });
  else $("reset-dialog").showModal();
});

$("cancel-reset").addEventListener("click", () => $("reset-dialog").close());
$("confirm-reset").addEventListener("click", () => {
  $("reset-dialog").close();
  newMatch({ focusSetup: true });
});

$("handoff-dialog").addEventListener("cancel", (event) =>
  event.preventDefault(),
);
$("reveal").addEventListener("click", () => {
  $("handoff-dialog").close();
  handoffAction();
  document.querySelector(".workspace").style.visibility = "visible";
  (game.phase === "setup"
    ? $("launch")
    : $("target-board").querySelector('[tabindex="0"]')
  )?.focus();
});

// Warn before leaving an active match, including refresh and browser navigation.
window.addEventListener("beforeunload", (event) => {
  if (game.phase !== "playing") return;
  event.preventDefault();
  event.returnValue = "";
});

document.querySelector(".brand").addEventListener("click", (event) => {
  if (
    game.phase !== "playing" ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  $("reset-dialog").showModal();
});

newMatch();
