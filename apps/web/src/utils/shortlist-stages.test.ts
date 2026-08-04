import { describe, expect, it } from "vitest";

import { getMilestoneActivityIds, ShortlistStage } from "./shortlist-stages";

const move = (
  publicId: string,
  fromList: ShortlistStage,
  toList: ShortlistStage,
  cardPublicId = "card-a",
) => ({
  publicId,
  type: "card.updated.list",
  card: { publicId: cardPublicId },
  fromList: { index: fromList },
  toList: { index: toList },
});

describe("getMilestoneActivityIds", () => {
  it("marks forward progress through Accepted as milestones", () => {
    const activities = [
      move("accepted", ShortlistStage.Negotiating, ShortlistStage.Accepted),
      move(
        "negotiating",
        ShortlistStage.Interviewing,
        ShortlistStage.Negotiating,
      ),
      move("applied", ShortlistStage.Saved, ShortlistStage.Applied),
    ];

    expect(getMilestoneActivityIds(activities)).toEqual(
      new Set(["accepted", "negotiating", "applied"]),
    );
  });

  it("keeps only the latest forward move to the same stage", () => {
    const activities = [
      move("applied-latest", ShortlistStage.Saved, ShortlistStage.Applied),
      move("back-to-saved", ShortlistStage.Applied, ShortlistStage.Saved),
      move("applied-first", ShortlistStage.Saved, ShortlistStage.Applied),
    ];

    expect(getMilestoneActivityIds(activities)).toEqual(
      new Set(["applied-latest"]),
    );
  });

  it("does not mark backward moves, Rejected, or Withdrawn", () => {
    const activities = [
      move("withdrawn", ShortlistStage.Applied, ShortlistStage.Withdrawn),
      move("rejected", ShortlistStage.Interviewing, ShortlistStage.Rejected),
      move("backward", ShortlistStage.Interviewing, ShortlistStage.Applied),
    ];

    expect(getMilestoneActivityIds(activities)).toEqual(new Set());
  });

  it("tracks repeated stages independently for each card", () => {
    const activities = [
      move("card-a-applied", ShortlistStage.Saved, ShortlistStage.Applied),
      move(
        "card-b-applied",
        ShortlistStage.Saved,
        ShortlistStage.Applied,
        "card-b",
      ),
    ];

    expect(getMilestoneActivityIds(activities)).toEqual(
      new Set(["card-a-applied", "card-b-applied"]),
    );
  });
});
