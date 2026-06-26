import { t } from "@lingui/core/macro";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventData, Step } from "react-joyride";
import { ACTIONS, EVENTS, Joyride, STATUS } from "react-joyride";

import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import {
  OPPORTUNITY_TUTORIAL_ACTIVE_KEY,
  OPPORTUNITY_TUTORIAL_CARD_CREATED_EVENT,
  OPPORTUNITY_TUTORIAL_CREATED_CARD_KEY,
  OPPORTUNITY_TUTORIAL_FORCE_KEY,
  OPPORTUNITY_TUTORIAL_SEEN_KEY,
  START_OPPORTUNITY_TUTORIAL_EVENT,
} from "~/utils/onboarding";
import { BoardsTutorialTooltip } from "~/views/boards/components/BoardsTutorial";

interface TutorialCard {
  publicId: string;
}

interface TutorialList {
  publicId: string;
  name: string;
  cards: TutorialCard[];
}

interface BoardOpportunityTutorialProps {
  isTemplate?: boolean;
  isLoading: boolean;
  lists: TutorialList[];
  openNewCardForm: (listPublicId: string) => void;
}

interface OpportunityTutorialDebugEvent {
  at: string;
  event: string;
  modalContentType: string;
  stepIndex: number;
  run: boolean;
  details?: Record<string, unknown>;
}

type OpportunityTutorialDebugWindow = typeof window & {
  __shortlistOpportunityTutorialDebug?: OpportunityTutorialDebugEvent[];
};

export function BoardOpportunityTutorial({
  isTemplate,
  isLoading,
  lists,
  openNewCardForm,
}: BoardOpportunityTutorialProps) {
  const { closeModal, modalContentType } = useModal();
  const { canCreateCard } = usePermissions();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [createdCardPublicId, setCreatedCardPublicId] = useState<string | null>(
    null,
  );
  const [isModalAdvanceSuppressed, setIsModalAdvanceSuppressed] =
    useState(false);

  const recordDebugEvent = useCallback(
    (event: string, details?: Record<string, unknown>) => {
      const debugEvent: OpportunityTutorialDebugEvent = {
        at: new Date().toISOString(),
        event,
        modalContentType,
        stepIndex,
        run,
        details,
      };

      const debugWindow = window as OpportunityTutorialDebugWindow;
      debugWindow.__shortlistOpportunityTutorialDebug = [
        ...(debugWindow.__shortlistOpportunityTutorialDebug ?? []),
        debugEvent,
      ];

      window.dispatchEvent(
        new CustomEvent("shortlist:opportunity-tutorial-debug", {
          detail: debugEvent,
        }),
      );
    },
    [modalContentType, run, stepIndex],
  );

  const savedList = lists.find(
    (list) => list.name.trim().toLowerCase() === "saved",
  );

  const createdCardTarget = createdCardPublicId
    ? `[data-onboarding-card-public-id="${createdCardPublicId}"]`
    : "[data-onboarding='board-card']";

  const finishTutorial = useCallback(() => {
    localStorage.setItem(OPPORTUNITY_TUTORIAL_SEEN_KEY, "1");
    localStorage.removeItem(OPPORTUNITY_TUTORIAL_ACTIVE_KEY);
    localStorage.removeItem(OPPORTUNITY_TUTORIAL_FORCE_KEY);
    localStorage.removeItem(OPPORTUNITY_TUTORIAL_CREATED_CARD_KEY);
    setRun(false);
    setStepIndex(0);
  }, []);

  const steps = useMemo<Step[]>(
    () => [
      {
        target: "[data-onboarding='saved-list-add-card-button']",
        title: t`Add your first opportunity`,
        content: t`Start in Saved. Use this button whenever you find a job worth tracking, even before you apply.`,
        placement: "left",
        buttons: ["primary", "skip"],
      },
      {
        target: "[data-onboarding='new-card-title']",
        title: t`Add the job title`,
        content: t`Start with the role name. This is the only required field, so you can capture an opportunity quickly and fill in the rest later.`,
        placement: "bottom",
        buttons: ["back", "primary", "skip"],
      },
      {
        target: "[data-onboarding='new-card-company']",
        title: t`Add the company`,
        content: t`Company is optional, but useful. It keeps your shortlist easier to scan and helps later when comparing opportunities.`,
        placement: "bottom",
        buttons: ["back", "primary", "skip"],
      },
      {
        target: "[data-onboarding='new-card-url']",
        title: t`Save the posting URL`,
        content: t`The URL is optional too. Paste it when you have it, so you can always get back to the original opening.`,
        placement: "bottom",
        buttons: ["back", "primary", "skip"],
      },
      {
        target: "[data-onboarding='new-card-description']",
        title: t`Add notes or context`,
        content: t`Description is optional. Use it for requirements, recruiter notes, salary hints, or anything you do not want to lose.`,
        placement: "bottom",
        buttons: ["back", "primary", "skip"],
      },
      {
        target: "[data-onboarding='new-card-controls']",
        title: t`Set the quick details`,
        content: t`This row lets you choose the list, labels, interview date, and where the new opportunity should land in the list.`,
        placement: "bottom",
        buttons: ["back", "primary", "skip"],
      },
      {
        target: "[data-onboarding='create-card-submit']",
        title: t`Create the opportunity`,
        content: t`Create the opportunity and it will appear in Saved, ready to move through your pipeline.`,
        placement: "top",
        buttons: ["back", "skip"],
      },
      {
        target: createdCardTarget,
        title: t`Track the journey`,
        content: t`Move cards between Saved, Applied, Interviewing, and later stages as your search progresses. Card detail has more fields, and every activity and milestone gets logged for you.`,
        placement: "right",
        buttons: ["primary"],
      },
      {
        target: "body",
        title: t`Powerpack`,
        content: t`When you are ready, Powerpack can automate the busy parts: AI imports job posts, Magic Inbox captures replies, and the web clipper turns openings into structured opportunities.`,
        placement: "center",
        disableBeacon: true,
        spotlightPadding: 0,
        buttons: ["primary"],
        data: {
          learnMoreHref: "/settings/powerpack",
          learnMoreLabel: t`Learn more`,
          onLearnMore: finishTutorial,
        },
      },
    ],
    [createdCardTarget, finishTutorial],
  );

  const startTutorial = useCallback((source: "event" | "force") => {
    recordDebugEvent("startTutorial:attempt", {
      source,
      canCreateCard,
      hasSavedList: !!savedList,
      forceKey:
        localStorage.getItem(OPPORTUNITY_TUTORIAL_FORCE_KEY) === "1",
    });

    if (!canCreateCard || !savedList) return;

    const storedCreatedCardPublicId = localStorage.getItem(
      OPPORTUNITY_TUTORIAL_CREATED_CARD_KEY,
    );

    recordDebugEvent("startTutorial:accepted", {
      source,
      storedCreatedCardPublicId,
    });

    localStorage.setItem(OPPORTUNITY_TUTORIAL_ACTIVE_KEY, "1");
    localStorage.removeItem(OPPORTUNITY_TUTORIAL_SEEN_KEY);
    setCreatedCardPublicId(storedCreatedCardPublicId);
    setStepIndex(storedCreatedCardPublicId ? 7 : 0);
    setRun(true);
  }, [canCreateCard, recordDebugEvent, savedList]);

  useEffect(() => {
    const handleStartTutorial = () => startTutorial("event");

    window.addEventListener(
      START_OPPORTUNITY_TUTORIAL_EVENT,
      handleStartTutorial,
    );

    return () =>
      window.removeEventListener(
        START_OPPORTUNITY_TUTORIAL_EVENT,
        handleStartTutorial,
      );
  }, [startTutorial]);

  useEffect(() => {
    if (isTemplate || isLoading || !canCreateCard || !savedList) return;

    const shouldForceRun =
      localStorage.getItem(OPPORTUNITY_TUTORIAL_FORCE_KEY) === "1";
    if (shouldForceRun) {
      recordDebugEvent("forceEffect:consume");
      localStorage.removeItem(OPPORTUNITY_TUTORIAL_FORCE_KEY);
      startTutorial("force");
    }
  }, [
    canCreateCard,
    isLoading,
    isTemplate,
    recordDebugEvent,
    savedList,
    startTutorial,
  ]);

  useEffect(() => {
    if (!run || stepIndex !== 0 || modalContentType !== "NEW_CARD") return;
    if (isModalAdvanceSuppressed) return;

    recordDebugEvent("modalWatcher:advanceToStep1");
    setStepIndex(1);
  }, [
    isModalAdvanceSuppressed,
    modalContentType,
    recordDebugEvent,
    run,
    stepIndex,
  ]);

  useEffect(() => {
    if (!isModalAdvanceSuppressed || modalContentType === "NEW_CARD") return;

    recordDebugEvent("modalSuppression:release");
    setIsModalAdvanceSuppressed(false);
  }, [isModalAdvanceSuppressed, modalContentType, recordDebugEvent]);

  useEffect(() => {
    const handleCardCreated = () => {
      const cardPublicId = localStorage.getItem(
        OPPORTUNITY_TUTORIAL_CREATED_CARD_KEY,
      );

      if (!cardPublicId) return;

      recordDebugEvent("cardCreated:advanceToCreatedCard", { cardPublicId });
      setCreatedCardPublicId(cardPublicId);
      setStepIndex(7);
    };

    window.addEventListener(
      OPPORTUNITY_TUTORIAL_CARD_CREATED_EVENT,
      handleCardCreated,
    );

    return () =>
      window.removeEventListener(
        OPPORTUNITY_TUTORIAL_CARD_CREATED_EVENT,
        handleCardCreated,
      );
  }, [recordDebugEvent]);

  const handleEvent = (data: EventData) => {
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (
      finishedStatuses.includes(data.status) ||
      data.action === ACTIONS.CLOSE ||
      data.action === ACTIONS.SKIP
    ) {
      finishTutorial();
      return;
    }

    if (data.type === EVENTS.STEP_AFTER && data.action === ACTIONS.NEXT) {
      if (data.index === 0) {
        if (!savedList) return;
        recordDebugEvent("joyride:openForm", {
          savedListPublicId: savedList.publicId,
          action: data.action,
          type: data.type,
        });
        setIsModalAdvanceSuppressed(true);
        setStepIndex(1);
        if (modalContentType !== "NEW_CARD") {
          openNewCardForm(savedList.publicId);
        }
        return;
      }

      setStepIndex(data.index + 1);
    }

    if (data.type === EVENTS.STEP_AFTER && data.action === ACTIONS.PREV) {
      if (data.index === 1 && modalContentType === "NEW_CARD") {
        setIsModalAdvanceSuppressed(true);
        closeModal();
        setStepIndex(0);
        return;
      }

      setStepIndex(Math.max(data.index - 1, 0));
    }
  };

  if (isTemplate) return null;

  return (
    <Joyride
      continuous
      onEvent={handleEvent}
      run={run}
      scrollToFirstStep
      stepIndex={stepIndex}
      steps={steps}
      tooltipComponent={BoardsTutorialTooltip}
      locale={{
        back: t`Back`,
        close: t`Close`,
        last: t`Finish`,
        next: stepIndex === 0 ? t`Open form` : t`Next`,
        skip: t`Skip`,
      }}
      options={{
        backgroundColor: "#ffffff",
        blockTargetInteraction: false,
        closeButtonAction: "skip",
        overlayClickAction: false,
        overlayColor: "rgba(0, 0, 0, 0.42)",
        primaryColor: "#171717",
        showProgress: false,
        skipBeacon: true,
        spotlightPadding: 8,
        spotlightRadius: 8,
        targetWaitTimeout: 3000,
        textColor: "#171717",
        width: 360,
        zIndex: 1000,
      }}
    />
  );
}
