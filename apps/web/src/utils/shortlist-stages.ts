export enum ShortlistStage {
  Saved = 0,
  Applied = 1,
  InContact = 2,
  Interviewing = 3,
  Negotiating = 4,
  Accepted = 5,
  Rejected = 6,
  Withdrawn = 7,
}

interface ListChangeActivity {
  publicId: string;
  type: string;
  card?: { publicId: string } | null;
  fromList?: { index: number } | null;
  toList?: { index: number } | null;
}

const isForwardProgressMove = (activity: ListChangeActivity) => {
  const fromStage = activity.fromList?.index as ShortlistStage | undefined;
  const toStage = activity.toList?.index as ShortlistStage | undefined;

  if (activity.type !== "card.updated.list") return false;
  if (fromStage === undefined || toStage === undefined) return false;

  return (
    toStage > fromStage &&
    toStage >= ShortlistStage.Applied &&
    toStage <= ShortlistStage.Accepted
  );
};

export const getMilestoneActivityIds = <T extends ListChangeActivity>(
  activities: T[],
) => {
  const milestoneIds = new Set<string>();
  const seenForwardStages = new Set<string>();

  // Activities are ordered newest-first. The first forward move encountered
  // for a card and destination stage is therefore the latest occurrence.
  for (const activity of activities) {
    if (!isForwardProgressMove(activity)) continue;

    const cardPublicId = activity.card?.publicId ?? "current-card";
    const destinationStage = activity.toList?.index;
    if (destinationStage === undefined) continue;

    const stageKey = `${cardPublicId}:${destinationStage}`;
    if (seenForwardStages.has(stageKey)) continue;

    seenForwardStages.add(stageKey);
    milestoneIds.add(activity.publicId);
  }

  return milestoneIds;
};
