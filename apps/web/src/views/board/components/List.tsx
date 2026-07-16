import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Draggable } from "react-beautiful-dnd";
import { HiOutlinePaperClip, HiOutlinePlusSmall } from "react-icons/hi2";

import { Tooltip } from "~/components/Tooltip";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";

interface ListProps {
  children: ReactNode;
  index: number;
  isArchived?: boolean;
  isTutorialTarget?: boolean;
  list: List;
  setSelectedPublicListId: (publicListId: PublicListId) => void;
}

interface List {
  publicId: string;
  name: string;
  createdBy?: string | null;
}

type PublicListId = string;

export default function List({
  children,
  index,
  isArchived = false,
  isTutorialTarget = false,
  list,
  setSelectedPublicListId,
}: ListProps) {
  const { openModal } = useModal();
  const { canCreateCard } = usePermissions();
  const canAddCard = canCreateCard && !isArchived;
  const isSavedList = index === 0 && list.name === "Saved";

  const openNewCardForm = (publicListId: PublicListId) => {
    if (!canAddCard) return;
    openModal("NEW_CARD");
    setSelectedPublicListId(publicListId);
  };

  const openSavedFileUploadForm = (publicListId: PublicListId) => {
    if (!canAddCard || !isSavedList) return;
    openModal("SAVED_FILE_UPLOAD");
    setSelectedPublicListId(publicListId);
  };

  return (
    <Draggable
      key={list.publicId}
      draggableId={list.publicId}
      index={index}
      isDragDisabled
    >
      {(provided) => (
        <div
          key={list.publicId}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="dark-text-dark-1000 mr-5 h-fit min-w-[18rem] max-w-[18rem] rounded-md border border-light-400 bg-light-300 py-2 pl-2 pr-1 text-neutral-900 dark:border-dark-300 dark:bg-dark-100"
        >
          <div className="mb-2 flex justify-between">
            <div className="w-full px-4 pt-1 text-sm font-medium text-neutral-900 dark:text-dark-1000">
              {list.name}
            </div>
            <div className="flex items-center">
              {isSavedList && (
                <Tooltip
                  content={
                    isArchived
                      ? t`Archived shortlists are read-only`
                      : !canCreateCard
                        ? t`You don't have permission`
                        : t`Upload file`
                  }
                >
                  <button
                    className="mx-1 inline-flex h-fit items-center rounded-md p-1 px-1 text-sm font-semibold text-dark-50 hover:bg-light-400 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-dark-200"
                    onClick={() => openSavedFileUploadForm(list.publicId)}
                    disabled={!canAddCard}
                    aria-label={t`Upload file`}
                  >
                    <HiOutlinePaperClip
                      className="h-4 w-4 text-dark-900"
                      aria-hidden="true"
                    />
                  </button>
                </Tooltip>
              )}
              <Tooltip
                content={
                  isArchived
                    ? t`Archived shortlists are read-only`
                    : !canCreateCard
                      ? t`You don't have permission`
                      : undefined
                }
              >
                <button
                  data-onboarding={
                    isTutorialTarget ? "saved-list-add-card-button" : undefined
                  }
                  className="mx-1 inline-flex h-fit items-center rounded-md p-1 px-1 text-sm font-semibold text-dark-50 hover:bg-light-400 disabled:opacity-60 disabled:cursor-not-allowed dark:hover:bg-dark-200"
                  onClick={() => openNewCardForm(list.publicId)}
                  disabled={!canAddCard}
                >
                  <HiOutlinePlusSmall
                    className="h-5 w-5 text-dark-900"
                    aria-hidden="true"
                  />
                </button>
              </Tooltip>
            </div>
          </div>
          {children}
        </div>
      )}
    </Draggable>
  );
}
