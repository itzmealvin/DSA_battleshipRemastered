import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";
const browser = await chromium.launch();
let failed = 0;
async function check(name, run) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await run(page);
    console.log("PASS " + name);
  } catch (e) {
    failed++;
    console.log("FAIL " + name + ": " + e.stack);
  } finally {
    await context.close();
  }
}
const url = process.env.BATTLESHIP_TEST_URL || "http://127.0.0.1:5173";
await check(
  "keyboard firing, repeated shots, reset cancellation and confirmation",
  async (p) => {
    await p.goto(url);
    await p.locator("#launch").click();
    await p.locator('#target-board [data-cell="0"]').focus();
    await p.keyboard.press("ArrowRight");
    assert.equal(
      await p.evaluate(() => document.activeElement.dataset.cell),
      "1",
    );
    await p.keyboard.press("Enter");
    assert.equal(
      await p.locator("#target-board .hit,#target-board .miss").count(),
      1,
    );
    await p.locator("#new-game").click();
    await p.locator("#cancel-reset").click();
    assert.equal(
      await p.locator("#target-board .hit,#target-board .miss").count(),
      1,
    );
    await p.locator("#new-game").click();
    await p.locator("#confirm-reset").click();
    assert.equal(
      await p.locator("#target-board .hit,#target-board .miss").count(),
      0,
    );
    assert.equal(await p.locator("#own-board .ship").count(), 17);
  },
);
await check(
  "local handoff hides fleets, cannot escape, clears lens and changes player",
  async (p) => {
    await p.goto(url);
    await p.locator("#mode").selectOption("local");
    await p.locator("#launch").click();
    assert.equal(
      await p
        .locator(".workspace")
        .evaluate((e) => getComputedStyle(e).visibility),
      "hidden",
    );
    await p.keyboard.press("Escape");
    assert.equal(
      await p.locator("#handoff-dialog").evaluate((e) => e.open),
      true,
    );
    await p.locator("#reveal").click();
    assert.equal(await p.locator("#own-title").innerText(), "Player 2’s fleet");
    const cells = await p
      .locator("#own-board .ship")
      .evaluateAll((es) => es.map((e) => Number(e.dataset.cell)));
    await p.locator("#launch").click();
    await p.locator("#reveal").click();
    assert.equal(
      await p.locator("#phase-label").innerText(),
      "Player 1’s turn",
    );
    assert.equal(await p.locator("#target-board .ship").count(), 0);
    await p.locator("#lens").check();
    await p.locator(`#target-board [data-cell="${cells[0]}"]`).click();
    assert.match(await p.locator("#manifest-caption").innerText(), /^16 /);
    const miss = Array.from({ length: 100 }, (_, i) => i).find(
      (c) => !cells.includes(c),
    );
    await p.locator(`#target-board [data-cell="${miss}"]`).click();
    assert.equal(
      await p
        .locator(".workspace")
        .evaluate((e) => getComputedStyle(e).visibility),
      "hidden",
    );
    await p.locator("#reveal").click();
    assert.equal(
      await p.locator("#phase-label").innerText(),
      "Player 2’s turn",
    );
    assert.equal(await p.locator("#lens").isChecked(), false);
  },
);
await check(
  "solo victory is immediate, counts shots and saves record once",
  async (p) => {
    await p.addInitScript(() => {
      let n = 4;
      Math.random = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
    });
    await p.goto(url);
    let n = 4;
    const g = createGame({
      rng: () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646,
    });
    await p.locator("#launch").click();
    for (const c of g.fleets[1].ships.flatMap((s) => s.cells))
      await p.locator(`#target-board [data-cell="${c}"]`).click();
    assert.equal(await p.locator("#phase-label").innerText(), "You win!");
    assert.equal(await p.locator("#enemy-count").innerText(), "0 afloat");
    assert.match(await p.locator("#manifest-caption").innerText(), /^0 /);
    assert.match(await p.locator("#turn-label").innerText(), /^17 shots/);
    await p.locator('#target-board [data-cell="0"]').dispatchEvent("click");
    assert.equal(await p.locator("#record").innerText(), "1 wins / 0 losses");
    await p.reload();
    assert.equal(await p.locator("#record").innerText(), "1 wins / 0 losses");
  },
);
await check("navigation warns before discarding an active match", async (p) => {
  await p.goto(url);
  await p.locator("#launch").click();
  await p.locator(".brand").click();
  assert.equal(await p.locator("#reset-dialog").evaluate((e) => e.open), true);
  await p.locator("#cancel-reset").click();
  let warned = false;
  p.once("dialog", async (d) => {
    warned = d.type() === "beforeunload";
    await d.dismiss();
  });
  await p.reload({ timeout: 3000 }).catch(() => {});
  assert.equal(warned, true);
});
await check("storage denial does not break startup", async (p) => {
  await p.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await p.goto(url);
  assert.equal(await p.locator("#own-board .ship").count(), 17);
  await p.locator("#launch").click();
  assert.equal(await p.locator("#phase-label").innerText(), "Your turn");
});
await check(
  "corrupted saved records fall back to an empty record",
  async (p) => {
    await p.addInitScript(() =>
      localStorage.setItem("battleship-record", "{broken"),
    );
    await p.goto(url);
    assert.equal(await p.locator("#record").innerText(), "0 wins / 0 losses");
    assert.equal(await p.locator("#own-board .ship").count(), 17);
  },
);
await check("a reset cancels the queued computer turn", async (p) => {
  await p.clock.install();
  await p.addInitScript(() => {
    let n = 4;
    Math.random = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
  });
  await p.goto(url);
  let n = 4;
  const g = createGame({
    rng: () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646,
  });
  const miss = Array.from({ length: 100 }, (_, i) => i).find(
    (c) => !g.fleets[1].ships.some((s) => s.cells.includes(c)),
  );
  await p.locator("#launch").click();
  await p.locator(`#target-board [data-cell="${miss}"]`).click();
  assert.equal(
    await p.locator("#phase-label").innerText(),
    "Computer is plotting…",
  );
  assert.equal(
    await p.locator('#target-board [aria-disabled="false"]').count(),
    0,
  );
  await p.locator("#new-game").click();
  await p.locator("#confirm-reset").click();
  await p.clock.runFor(2000);
  assert.equal(await p.locator("#phase-label").innerText(), "Ready to deploy");
  assert.equal(await p.locator("#own-board .hit, #own-board .miss").count(), 0);
});
for (const width of [320, 375, 768, 1024, 1440]) {
  await check(
    `responsive layout and accessibility at ${width}px`,
    async (p) => {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(url);
      assert.equal(await p.locator("#own-board .ship").count(), 17);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const result = await new AxeBuilder({ page: p }).analyze();
      assert.deepEqual(
        result.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
        [],
      );
      await p.locator("#launch").click();
      const target = p.locator('#target-board [data-cell="0"]');
      const bounds = await target.boundingBox();
      assert.ok(
        bounds.width >= 24 && bounds.height >= 24,
        "target cells must be at least 24px",
      );
      const playing = await new AxeBuilder({ page: p }).analyze();
      assert.deepEqual(
        playing.violations.map((v) => v.id),
        [],
      );
    },
  );
}
await check("static assets and help dialog", async (p) => {
  await p.goto(url);
  for (const path of [
    "/favicon.svg",
    "/404.html",
    "/styles/styles.css",
    "/src/app.js",
    "/src/game.js",
  ]) {
    assert.equal((await p.request.get(url + path)).status(), 200, path);
  }
  await p.locator("#how-to").click();
  assert.deepEqual(
    (await new AxeBuilder({ page: p }).analyze()).violations.map((v) => v.id),
    [],
  );
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("#help-dialog").evaluate((e) => e.open), false);
});
await browser.close();
if (failed) process.exitCode = 1;
