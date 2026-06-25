import { t } from "@lingui/core/macro";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventData, Step, TooltipRenderProps } from "react-joyride";
import { ACTIONS, EVENTS, Joyride, STATUS } from "react-joyride";

import Button from "~/components/Button";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import {
  SHORTLIST_TUTORIAL_ACTIVE_KEY,
  SHORTLIST_TUTORIAL_FORCE_KEY,
  SHORTLIST_TUTORIAL_SEEN_KEY,
  SHORTLIST_TUTORIAL_SUBMITTED_KEY,
  START_SHORTLIST_TUTORIAL_EVENT,
} from "~/utils/onboarding";

function BoardsTutorialTooltip({
  backProps,
  closeProps,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  const showBack = step.buttons.includes("back") && index > 0;
  const showSkip = step.buttons.includes("skip") && !isLastStep;
  const showClose = step.buttons.includes("close");
  const showPrimary = step.buttons.includes("primary");

  return (
    <div
      {...tooltipProps}
      className="w-[min(360px,calc(100vw-2rem))] rounded-lg border border-light-600 bg-light-50 p-5 text-light-1000 shadow-lg dark:border-dark-600 dark:bg-dark-300 dark:text-dark-1000"
    >
      {step.title && (
        <h2 className="text-sm font-bold leading-[1.35] text-light-1000 dark:text-dark-1000">
          {step.title}
        </h2>
      )}
      <div className="mt-2 text-sm font-normal leading-[1.55] text-light-900 dark:text-dark-900">
        {step.content}
      </div>
      <div className="mt-5 flex items-center gap-2">
        <p className="mr-auto text-xs font-medium text-light-900 dark:text-dark-900">
          {t`${index + 1} of ${size}`}
        </p>
        {showBack && (
          <Button
            {...backProps}
            type="button"
            variant="secondary"
            size="sm"
            className="shadow-none"
          >
            {t`Back`}
          </Button>
        )}
        {showSkip && (
          <Button
            {...skipProps}
            type="button"
            variant="ghost"
            size="sm"
            className="shadow-none"
          >
            {t`Skip`}
          </Button>
        )}
        {showClose && (
          <Button
            {...closeProps}
            type="button"
            variant="ghost"
            size="sm"
            className="shadow-none"
          >
            {t`Close`}
          </Button>
        )}
        {showPrimary && (
          <Button
            {...primaryProps}
            type="button"
            variant="primary"
            size="sm"
            className="shadow-none"
          >
            {isLastStep ? t`Done` : step.locale.next}
          </Button>
        )}
      </div>
    </div>
  );
}

export function BoardsTutorial({ isTemplate }: { isTemplate?: boolean }) {
  const { workspace } = useWorkspace();
  const { openModal } = useModal();
  const { canCreateBoard } = usePermissions();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const { data: boards, isLoading } = api.board.all.useQuery(
    {
      workspacePublicId: workspace.publicId,
      type: "regular",
      archived: false,
    },
    { enabled: !isTemplate && !!workspace.publicId },
  );

  const steps = useMemo<Step[]>(
    () => [
      {
        target: "[data-onboarding='new-shortlist-button']",
        title: t`Create your first shortlist`,
        content: t`A shortlist is where your job opportunities will live. Start with one board and keep the preset if it already feels right.`,
        placement: "bottom-end",
        buttons: ["primary", "skip"],
      },
      {
        target: "#name",
        title: t`Name your shortlist`,
        content: t`You can keep the suggested name, or change it to whatever fits this search.`,
        placement: "bottom",
      },
      {
        target: "[data-onboarding='create-shortlist-submit']",
        title: t`Create the shortlist`,
        content: t`Click Create shortlist and we will take you straight into the new board.`,
        placement: "top",
        buttons: ["back", "skip"],
      },
    ],
    [],
  );

  const startTutorial = useCallback(() => {
    if (!canCreateBoard) return;

    localStorage.setItem(SHORTLIST_TUTORIAL_ACTIVE_KEY, "1");
    localStorage.removeItem(SHORTLIST_TUTORIAL_SEEN_KEY);
    localStorage.removeItem(SHORTLIST_TUTORIAL_SUBMITTED_KEY);
    setStepIndex(0);
    setRun(true);
  }, [canCreateBoard]);

  useEffect(() => {
    const handleStartTutorial = () => startTutorial();

    window.addEventListener(START_SHORTLIST_TUTORIAL_EVENT, handleStartTutorial);

    return () =>
      window.removeEventListener(
        START_SHORTLIST_TUTORIAL_EVENT,
        handleStartTutorial,
      );
  }, [startTutorial]);

  useEffect(() => {
    if (isTemplate || isLoading || !canCreateBoard || !workspace.name) return;

    const shouldForceRun =
      localStorage.getItem(SHORTLIST_TUTORIAL_FORCE_KEY) === "1";
    const hasSeenTutorial =
      localStorage.getItem(SHORTLIST_TUTORIAL_SEEN_KEY) === "1";
    const hasSubmittedTutorial =
      localStorage.getItem(SHORTLIST_TUTORIAL_SUBMITTED_KEY) === "1";
    const hasNoShortlists = boards?.length === 0;

    if (hasSubmittedTutorial) return;

    if (shouldForceRun || (!hasSeenTutorial && hasNoShortlists)) {
      localStorage.removeItem(SHORTLIST_TUTORIAL_FORCE_KEY);
      startTutorial();
    }
  }, [
    boards?.length,
    canCreateBoard,
    isLoading,
    isTemplate,
    startTutorial,
    workspace.name,
  ]);

  const finishTutorial = () => {
    localStorage.setItem(SHORTLIST_TUTORIAL_SEEN_KEY, "1");
    localStorage.removeItem(SHORTLIST_TUTORIAL_ACTIVE_KEY);
    localStorage.removeItem(SHORTLIST_TUTORIAL_FORCE_KEY);
    localStorage.removeItem(SHORTLIST_TUTORIAL_SUBMITTED_KEY);
    setRun(false);
    setStepIndex(0);
  };

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
        openModal("NEW_BOARD");
        window.setTimeout(() => setStepIndex(1), 150);
        return;
      }

      setStepIndex(data.index + 1);
    }

    if (data.type === EVENTS.STEP_AFTER && data.action === ACTIONS.PREV) {
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
