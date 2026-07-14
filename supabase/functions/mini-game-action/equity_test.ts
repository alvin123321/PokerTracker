import assert from "node:assert/strict";

import {
  allocateDisplayPercentages,
  calculateExactEquities,
  labelForHandStrength,
  type MiniGameSnapshot,
} from "./equity.ts";

const GAME_ID = "10000000-0000-4000-8000-000000000001";

const snapshot = (
  status: MiniGameSnapshot["status"],
  board: string[],
  hands: string[][],
): MiniGameSnapshot => ({
  id: GAME_ID,
  stateVersion: 7,
  status,
  board: board.map((code, index) => ({ position: index + 1, code })),
  participants: hands.map((cards, participantIndex) => ({
    id: `20000000-0000-4000-8000-${
      String(participantIndex + 1).padStart(12, "0")
    }`,
    cards: cards.map((code, index) => ({ position: index + 1, code })),
  })),
});

Deno.test("calculateExactEquities records an exact known winner", () => {
  const result = calculateExactEquities(
    snapshot("COMPLETE", ["2c", "3d", "4h", "8s", "9c"], [
      ["As", "Ad"],
      ["Ks", "Kd"],
    ]),
  );

  assert.deepEqual(
    result.map((
      { equityShare, displayPercentage, wins, ties, totalOutcomes },
    ) => ({
      equityShare,
      displayPercentage,
      wins,
      ties,
      totalOutcomes,
    })),
    [
      {
        equityShare: 1,
        displayPercentage: 100,
        wins: 1,
        ties: 0,
        totalOutcomes: 1,
      },
      {
        equityShare: 0,
        displayPercentage: 0,
        wins: 0,
        ties: 0,
        totalOutcomes: 1,
      },
    ],
  );
});

Deno.test("calculateExactEquities splits tied outcomes by raw evaluator equity", () => {
  const result = calculateExactEquities(
    snapshot("COMPLETE", ["Ah", "Kh", "Qh", "Jh", "Th"], [
      ["2c", "3d"],
      ["4c", "5d"],
    ]),
  );

  assert.deepEqual(
    result.map((
      {
        equityShare,
        displayPercentage,
        wins,
        ties,
        totalOutcomes,
        finalHandLabel,
      },
    ) => ({
      equityShare,
      displayPercentage,
      wins,
      ties,
      totalOutcomes,
      finalHandLabel,
    })),
    [
      {
        equityShare: 0.5,
        displayPercentage: 50,
        wins: 0,
        ties: 1,
        totalOutcomes: 1,
        finalHandLabel: "Straight Flush",
      },
      {
        equityShare: 0.5,
        displayPercentage: 50,
        wins: 0,
        ties: 1,
        totalOutcomes: 1,
        finalHandLabel: "Straight Flush",
      },
    ],
  );
});

Deno.test("calculateExactEquities exhausts every legal board at each game stage", () => {
  const cases: Array<{
    status: MiniGameSnapshot["status"];
    board: string[];
    totalOutcomes: number;
  }> = [
    { status: "OPEN", board: [], totalOutcomes: 1_712_304 },
    { status: "FLOP", board: ["2c", "3d", "4h"], totalOutcomes: 990 },
    { status: "TURN", board: ["2c", "3d", "4h", "8s"], totalOutcomes: 44 },
    {
      status: "COMPLETE",
      board: ["2c", "3d", "4h", "8s", "9c"],
      totalOutcomes: 1,
    },
  ];

  for (const testCase of cases) {
    const result = calculateExactEquities(
      snapshot(testCase.status, testCase.board, [
        ["As", "Ad"],
        ["Ks", "Kd"],
      ]),
    );

    assert.deepEqual(
      result.map((equity) => equity.totalOutcomes),
      [testCase.totalOutcomes, testCase.totalOutcomes],
      testCase.status,
    );
    assert.equal(
      Math.round(
        result.reduce((total, equity) => total + equity.displayPercentage, 0) *
          10,
      ),
      1000,
      testCase.status,
    );
  }
});

Deno.test("calculateExactEquities handles zero and one participant deterministically", () => {
  assert.deepEqual(calculateExactEquities(snapshot("OPEN", [], [])), []);

  const [onlyParticipant] = calculateExactEquities(
    snapshot("OPEN", [], [["As", "Ad"]]),
  );

  assert.deepEqual(onlyParticipant, {
    participantId: "20000000-0000-4000-8000-000000000001",
    equityShare: 1,
    displayPercentage: 100,
    wins: 1,
    ties: 0,
    totalOutcomes: 1,
    finalHandLabel: null,
  });
});

Deno.test("calculateExactEquities rejects missing, invalid, and duplicate cards", () => {
  assert.throws(
    () => calculateExactEquities(snapshot("OPEN", [], [["As"]])),
    /exactly two cards/i,
  );
  assert.throws(
    () => calculateExactEquities(snapshot("OPEN", [], [["As", "1d"]])),
    /invalid card/i,
  );
  assert.throws(
    () =>
      calculateExactEquities(
        snapshot("OPEN", [], [
          ["As", "Ad"],
          ["As", "Kd"],
        ]),
      ),
    /globally unique/i,
  );
  assert.throws(
    () =>
      calculateExactEquities(snapshot("FLOP", ["2c", "3d"], [["As", "Ad"]])),
    /FLOP.*three board cards/i,
  );
});

Deno.test("allocateDisplayPercentages uses stable largest-remainder allocation", () => {
  assert.deepEqual(allocateDisplayPercentages([1 / 3, 1 / 3, 1 / 3]), [
    33.4,
    33.3,
    33.3,
  ]);
  assert.deepEqual(allocateDisplayPercentages([0.50005, 0.49995]), [50, 50]);
  assert.equal(
    Math.round(
      allocateDisplayPercentages([0.1, 0.2, 0.3, 0.4]).reduce(
        (a, b) => a + b,
        0,
      ) * 10,
    ),
    1000,
  );
});

Deno.test("labelForHandStrength maps all standard final hand labels", () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, strength) => labelForHandStrength(strength)),
    [
      "High Card",
      "Pair",
      "Two Pair",
      "Three of a Kind",
      "Straight",
      "Flush",
      "Full House",
      "Four of a Kind",
      "Straight Flush",
      "Straight Flush",
    ],
  );
});
