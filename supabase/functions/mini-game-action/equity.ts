import { evaluate, odds } from "@poker-apprentice/hand-evaluator";

type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";
type Suit = "c" | "d" | "h" | "s";
type Card = `${Rank}${Suit}`;

export type MiniGameStatus = "OPEN" | "FLOP" | "TURN" | "COMPLETE";

export interface SnapshotCard {
  position: number;
  code: string;
}

export interface SnapshotParticipant {
  id: string;
  cards: SnapshotCard[];
}

export interface MiniGameSnapshot {
  id: string;
  stateVersion: number;
  status: MiniGameStatus;
  board: SnapshotCard[];
  participants: SnapshotParticipant[];
  [key: string]: unknown;
}

export interface PersistedEquity {
  participantId: string;
  equityShare: number;
  displayPercentage: number;
  wins: number;
  ties: number;
  totalOutcomes: number;
  finalHandLabel: string | null;
}

const cardPattern = /^[2-9TJQKA][cdhs]$/;
const boardCardCounts: Record<MiniGameStatus, number> = {
  OPEN: 0,
  FLOP: 3,
  TURN: 4,
  COMPLETE: 5,
};
const boardCountNames: Record<MiniGameStatus, string> = {
  OPEN: "zero",
  FLOP: "three",
  TURN: "four",
  COMPLETE: "five",
};

const asCard = (value: unknown): Card => {
  if (typeof value !== "string" || !cardPattern.test(value)) {
    throw new Error(`Invalid card code: ${String(value)}.`);
  }

  return value as Card;
};

const validateSnapshot = (snapshot: MiniGameSnapshot) => {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Mini-game snapshot is required.");
  }

  if (!(snapshot.status in boardCardCounts)) {
    throw new Error("Mini-game snapshot has an invalid status.");
  }

  if (!Array.isArray(snapshot.board)) {
    throw new Error("Mini-game board must be an array.");
  }

  const expectedBoardCount = boardCardCounts[snapshot.status];

  if (snapshot.board.length !== expectedBoardCount) {
    throw new Error(
      `${snapshot.status} mini-games must have ${
        boardCountNames[snapshot.status]
      } board cards.`,
    );
  }

  if (!Array.isArray(snapshot.participants)) {
    throw new Error("Mini-game participants must be an array.");
  }

  const knownCards = new Set<Card>();
  const participantIds = new Set<string>();

  const addKnownCard = (code: unknown) => {
    const card = asCard(code);

    if (knownCards.has(card)) {
      throw new Error("All known cards must be globally unique.");
    }

    knownCards.add(card);
    return card;
  };

  const board = snapshot.board.map((card) => addKnownCard(card?.code));
  const participants = snapshot.participants.map((participant) => {
    if (
      !participant || typeof participant.id !== "string" ||
      participant.id.length === 0
    ) {
      throw new Error("Every participant must have an id.");
    }

    if (participantIds.has(participant.id)) {
      throw new Error("Participant ids must be unique.");
    }

    participantIds.add(participant.id);

    if (!Array.isArray(participant.cards) || participant.cards.length !== 2) {
      throw new Error("Every participant must have exactly two cards.");
    }

    return {
      id: participant.id,
      cards: participant.cards.map((card) => addKnownCard(card?.code)),
    };
  });

  return { board, participants };
};

export const allocateDisplayPercentages = (
  shares: readonly number[],
): number[] => {
  if (shares.length === 0) {
    return [];
  }

  if (
    shares.some((share) => !Number.isFinite(share) || share < 0 || share > 1)
  ) {
    throw new Error(
      "Equity shares must be finite numbers between zero and one.",
    );
  }

  const shareTotal = shares.reduce((total, share) => total + share, 0);

  if (Math.abs(shareTotal - 1) > 1e-9) {
    throw new Error("Equity shares must total one.");
  }

  const allocations = shares.map((share, index) => {
    const exactTenths = share * 1_000;
    const tenths = Math.floor(exactTenths);

    return {
      index,
      remainder: exactTenths - tenths,
      tenths,
    };
  });
  const allocatedTenths = allocations.reduce(
    (total, allocation) => total + allocation.tenths,
    0,
  );
  const remainingTenths = 1_000 - allocatedTenths;

  if (remainingTenths < 0 || remainingTenths > allocations.length) {
    throw new Error("Equity shares cannot be allocated to one decimal place.");
  }

  const byRemainder = [...allocations].sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index,
  );

  for (let index = 0; index < remainingTenths; index += 1) {
    byRemainder[index].tenths += 1;
  }

  return allocations.map((allocation) => allocation.tenths / 10);
};

export const labelForHandStrength = (strength: number): string => {
  switch (strength) {
    case 0:
      return "High Card";
    case 1:
      return "Pair";
    case 2:
      return "Two Pair";
    case 3:
      return "Three of a Kind";
    case 4:
      return "Straight";
    case 5:
      return "Flush";
    case 6:
      return "Full House";
    case 7:
      return "Four of a Kind";
    case 8:
    case 9:
      return "Straight Flush";
    default:
      throw new Error(`Unknown hand strength: ${strength}.`);
  }
};

export const calculateExactEquities = (
  snapshot: MiniGameSnapshot,
): PersistedEquity[] => {
  const { board, participants } = validateSnapshot(snapshot);

  if (participants.length === 0) {
    return [];
  }

  if (participants.length === 1) {
    const participant = participants[0];

    return [
      {
        participantId: participant.id,
        equityShare: 1,
        displayPercentage: 100,
        wins: 1,
        ties: 0,
        totalOutcomes: 1,
        finalHandLabel: snapshot.status === "COMPLETE"
          ? labelForHandStrength(
            evaluate({ holeCards: participant.cards, communityCards: board })
              .strength,
          )
          : null,
      },
    ];
  }

  const results = odds(
    participants.map((participant) => participant.cards),
    {
      communityCards: board,
      expectedCommunityCardCount: 5,
      expectedHoleCardCount: 2,
      minimumHoleCardsUsed: 0,
      maximumHoleCardsUsed: 2,
    },
  );
  const displayPercentages = allocateDisplayPercentages(
    results.map((result) => result.equity),
  );

  return participants.map((participant, index) => ({
    participantId: participant.id,
    equityShare: results[index].equity,
    displayPercentage: displayPercentages[index],
    wins: results[index].wins,
    ties: results[index].ties,
    totalOutcomes: results[index].total,
    finalHandLabel: snapshot.status === "COMPLETE"
      ? labelForHandStrength(
        evaluate({ holeCards: participant.cards, communityCards: board })
          .strength,
      )
      : null,
  }));
};
