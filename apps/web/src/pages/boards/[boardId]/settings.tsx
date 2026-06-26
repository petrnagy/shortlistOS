import { useRouter } from "next/router";
import Link from "next/link";
import { t } from "@lingui/core/macro";

import type { NextPageWithLayout } from "~/pages/_app";
import Button from "~/components/Button";
import { getDashboardLayout } from "~/components/Dashboard";
import Modal from "~/components/modal";
import { PageHead } from "~/components/PageHead";
import Popup from "~/components/Popup";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { DeleteBoardConfirmation } from "~/views/board/components/DeleteBoardConfirmation";
import BoardsSettings from "~/views/settings/BoardsSettings";

const BoardSettingsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { canArchiveBoard, canDeleteBoard } = usePermissions();
  const { isOpen, modalContentType, openModal } = useModal();
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const boardId =
    typeof router.query.boardId === "string" ? router.query.boardId : null;

  const { data: boardData } = api.board.byId.useQuery(
    { boardPublicId: boardId ?? "" },
    { enabled: !!boardId },
  );

  const shortlistName = boardData?.name ?? t`Shortlist`;
  const isArchived = boardData?.isArchived ?? false;

  const archiveBoard = api.board.update.useMutation({
    onSuccess: async (_data, variables) => {
      await Promise.all([
        utils.board.all.invalidate(),
        boardId ? utils.board.byId.invalidate({ boardPublicId: boardId }) : null,
      ]);

      showPopup({
        header: variables.isArchived
          ? t`Shortlist archived`
          : t`Shortlist unarchived`,
        message: variables.isArchived
          ? t`The shortlist has been archived.`
          : t`The shortlist is active again.`,
        icon: "success",
      });

      if (variables.isArchived) {
        void router.push("/boards");
      }
    },
    onError: () => {
      showPopup({
        header: isArchived
          ? t`Unable to unarchive shortlist`
          : t`Unable to archive shortlist`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
  });

  const handleArchiveBoard = () => {
    if (!boardId) return;

    archiveBoard.mutate({
      boardPublicId: boardId,
      isArchived: !isArchived,
    });
  };

  return (
    <>
      <PageHead title={t`${shortlistName} settings`} />
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="h-full max-h-[calc(100vdh-3rem)] overflow-y-auto md:max-h-[calc(100vdh-4rem)]">
          <div className="m-auto max-w-[1100px] px-5 py-6 md:px-28 md:py-12">
            <div className="mb-8 flex w-full justify-between">
              <div>
                <h1 className="font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
                  {t`${shortlistName} settings`}
                </h1>
                {boardId ? (
                  <Link
                    href={`/boards/${boardId}`}
                    className="mt-2 inline-flex text-sm font-medium text-light-900 underline-offset-4 hover:underline dark:text-dark-900"
                  >
                    {t`Back to shortlist`}
                  </Link>
                ) : null}
              </div>
            </div>

            <BoardsSettings
              boardPublicId={boardId ?? ""}
              isBoardLoaded={!!boardData}
              isSalaryDataEnabled={
                boardData?.shortlistIsSalaryDataEnabled ?? false
              }
              isCompanySentimentEnabled={
                boardData?.shortlistIsCompanySentimentEnabled ?? false
              }
              isMagicInboxEnabled={
                boardData?.shortlistIsMagicInboxEnabled ?? false
              }
              isCalendarFeedEnabled={
                boardData?.shortlistIsCalendarFeedEnabled ?? false
              }
              isSavedReminderEnabled={
                boardData?.shortlistIsSavedReminderEnabled ?? false
              }
              savedReminderDays={
                boardData?.shortlistSavedReminderAfterDays ?? 7
              }
              isSavedAutoArchiveEnabled={
                boardData?.shortlistIsSavedAutoArchiveEnabled ?? false
              }
              savedAutoArchiveDays={
                boardData?.shortlistSavedAutoArchiveAfterDays ?? 14
              }
              isAppliedFollowUpReminderEnabled={
                boardData?.shortlistIsAppliedFollowUpReminderEnabled ?? false
              }
              appliedFollowUpReminderDays={
                boardData?.shortlistAppliedFollowUpReminderAfterDays ?? 7
              }
              isAppliedGhostedEnabled={
                boardData?.shortlistIsAppliedGhostedEnabled ?? false
              }
              appliedGhostedDays={
                boardData?.shortlistAppliedGhostedAfterDays ?? 14
              }
              isInterviewingNudgeEnabled={
                boardData?.shortlistIsInterviewingNudgeEnabled ?? false
              }
              interviewingNudgeDays={
                boardData?.shortlistInterviewingNudgeAfterDays ?? 3
              }
              isNegotiatingNudgeEnabled={
                boardData?.shortlistIsNegotiatingNudgeEnabled ?? false
              }
              negotiatingNudgeDays={
                boardData?.shortlistNegotiatingNudgeAfterDays ?? 3
              }
              isWeeklyDigestEnabled={
                boardData?.shortlistIsWeeklyDigestEnabled ?? false
              }
              isCardAgingEnabled={
                boardData?.shortlistIsCardAgingEnabled ?? false
              }
            />

            <section className="mb-8 mt-8 rounded-lg border border-light-300 bg-light-50 dark:border-dark-300 dark:bg-dark-100">
              <div className="border-b border-light-300 px-4 py-3 dark:border-dark-300">
                <h2 className="text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
                  {isArchived ? t`Unarchive shortlist` : t`Archive shortlist`}
                </h2>
              </div>
              <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-light-900 dark:text-dark-900">
                  {isArchived
                    ? t`Unarchive this shortlist to return it to your active shortlists. You will be able to edit it again.`
                    : t`Archive this shortlist to hide it from your active shortlists. You can find it again in archived shortlists.`}
                </p>
                <Button
                  variant="secondary"
                  onClick={handleArchiveBoard}
                  disabled={
                    !canArchiveBoard ||
                    !boardId ||
                    archiveBoard.isPending
                  }
                  isLoading={archiveBoard.isPending}
                  className="shadow-none"
                >
                  {isArchived ? t`Unarchive shortlist` : t`Archive shortlist`}
                </Button>
              </div>
            </section>

            <section className="mb-8 mt-8 rounded-lg border border-red-300 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/10">
              <div className="border-b border-red-200 px-4 py-3 dark:border-red-900/50">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
                    {t`Delete shortlist`}
                  </h2>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    {t`Danger`}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-light-900 dark:text-dark-900">
                  {t`Once you delete this shortlist, there is no going back. This action cannot be undone.`}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => openModal("DELETE_BOARD")}
                  disabled={!canDeleteBoard || !boardId}
                  className="border-red-300 text-red-700 shadow-none hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
                >
                  {t`Delete shortlist`}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "DELETE_BOARD"}
      >
        <DeleteBoardConfirmation
          isTemplate={false}
          boardPublicId={boardId ?? ""}
        />
      </Modal>
      <Popup />
    </>
  );
};

BoardSettingsPage.getLayout = (page) => getDashboardLayout(page);

export default BoardSettingsPage;
