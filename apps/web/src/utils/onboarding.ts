export const SHORTLIST_TUTORIAL_SEEN_KEY =
  "shortlist_onboarding_create_shortlist_seen";

export const SHORTLIST_TUTORIAL_ACTIVE_KEY =
  "shortlist_onboarding_create_shortlist_active";

export const SHORTLIST_TUTORIAL_FORCE_KEY =
  "shortlist_onboarding_create_shortlist_force";

export const SHORTLIST_TUTORIAL_SUBMITTED_KEY =
  "shortlist_onboarding_create_shortlist_submitted";

export const START_SHORTLIST_TUTORIAL_EVENT = "shortlist:start-tutorial";

export const OPPORTUNITY_TUTORIAL_SEEN_KEY =
  "shortlist_onboarding_create_opportunity_seen";

export const OPPORTUNITY_TUTORIAL_ACTIVE_KEY =
  "shortlist_onboarding_create_opportunity_active";

export const OPPORTUNITY_TUTORIAL_FORCE_KEY =
  "shortlist_onboarding_create_opportunity_force";

export const OPPORTUNITY_TUTORIAL_CREATED_CARD_KEY =
  "shortlist_onboarding_create_opportunity_card";

export const START_OPPORTUNITY_TUTORIAL_EVENT =
  "shortlist:start-opportunity-tutorial";

export const OPPORTUNITY_TUTORIAL_CARD_CREATED_EVENT =
  "shortlist:opportunity-tutorial-card-created";

export type TutorialJourney = "create-shortlist" | "create-opportunity";

export const TUTORIAL_JOURNEYS: Record<
  TutorialJourney,
  { name: "Shortlists" | "Opportunities" }
> = {
  "create-shortlist": {
    name: "Shortlists",
  },
  "create-opportunity": {
    name: "Opportunities",
  },
};

export const getTutorialJourneyForPathname = (
  pathname: string | null | undefined,
): TutorialJourney | null => {
  if (!pathname) return null;

  if (pathname === "/boards") return "create-shortlist";

  const pathParts = pathname.split("/").filter(Boolean);

  if (pathParts.length === 2 && pathParts[0] === "boards") {
    return "create-opportunity";
  }

  return null;
};
