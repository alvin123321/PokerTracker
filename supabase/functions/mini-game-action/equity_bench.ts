import { calculateExactEquities, type MiniGameSnapshot } from "./equity.ts";

const hands = [
  ["As", "Ad"],
  ["Ks", "Kd"],
  ["Qs", "Qd"],
  ["Js", "Jd"],
  ["Ts", "Td"],
  ["9s", "9d"],
  ["8s", "8d"],
  ["7s", "7d"],
  ["6s", "6d"],
  ["5s", "5d"],
];

const preflopSnapshot = (playerCount: number): MiniGameSnapshot => ({
  id: "10000000-0000-4000-8000-000000000001",
  stateVersion: 1,
  status: "OPEN",
  board: [],
  participants: hands.slice(0, playerCount).map((cards, participantIndex) => ({
    id: `20000000-0000-4000-8000-${
      String(participantIndex + 1).padStart(12, "0")
    }`,
    cards: cards.map((code, cardIndex) => ({ position: cardIndex + 1, code })),
  })),
});

for (const playerCount of [2, 10]) {
  const input = preflopSnapshot(playerCount);

  Deno.bench(`exact preflop equity - ${playerCount} players`, () => {
    const startedAt = performance.now();
    calculateExactEquities(input);
    const elapsedMs = performance.now() - startedAt;

    if (elapsedMs > 1_500) {
      throw new Error(
        `${playerCount}-player exact preflop equity exceeded 1500ms: ${
          elapsedMs.toFixed(1)
        }ms`,
      );
    }
  });
}
