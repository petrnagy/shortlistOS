import { t } from "@lingui/core/macro";
import {
  HiEllipsisHorizontal,
  HiOutlineCheckCircle,
  HiOutlineDocumentDuplicate,
  HiOutlineTrash,
} from "react-icons/hi2";

import { authClient } from "@kan/auth/client";

import Dropdown from "~/components/Dropdown";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

export default function CardDropdown({
  cardPublicId,
  cardCreatedBy,
  listPublicId,
  cardIndex,
}: {
  cardPublicId: string;
  cardCreatedBy?: string | null;
  listPublicId?: string;
  cardIndex?: number;
}) {
  const { openModal } = useModal();
  const { showPopup } = usePopup();
  const { canEditCard, canDeleteCard } = usePermissions();
  const { data: session } = authClient.useSession();
  const utils = api.useUtils();
  const isCreator = cardCreatedBy && session?.user.id === cardCreatedBy;

  const duplicateCard = api.card.duplicate.useMutation({
    onSuccess: () => {
      showPopup({
        header: t`Opportunity duplicated`,
        icon: "success",
        message: t`Opportunity duplicated successfully.`,
      });
    },
    onError: () => {
      showPopup({
        header: t`Unable to duplicate opportunity`,
        icon: "error",
        message: t`Please try again.`,
      });
    },
    onSettled: async () => {
      await utils.board.byId.invalidate();
    },
  });

  const items = [
    ...(canEditCard
      ? [
          {
            label: t`Add checklist`,
            action: () => openModal("ADD_CHECKLIST"),
            icon: (
              <HiOutlineCheckCircle className="h-[16px] w-[16px] text-dark-900" />
            ),
          },
          {
            label: t`Duplicate opportunity`,
            action: () => {
              if (!listPublicId || cardIndex === undefined) return;
              duplicateCard.mutate({
                cardPublicId,
                listPublicId,
                index: cardIndex + 1,
                copyLabels: true,
                copyMembers: true,
                copyChecklists: true,
              });
            },
            icon: (
              <HiOutlineDocumentDuplicate className="h-[16px] w-[16px] text-dark-900" />
            ),
            disabled: duplicateCard.isPending || !listPublicId,
          },
        ]
      : []),
    ...(canDeleteCard || isCreator
      ? [
          {
            label: t`Delete opportunity`,
            action: () => openModal("DELETE_CARD"),
            icon: (
              <HiOutlineTrash className="h-[16px] w-[16px] text-dark-900" />
            ),
          },
        ]
      : []),
  ];

  if (items.length === 0) {
    return null;
  }

  return (
    <Dropdown items={items}>
      <HiEllipsisHorizontal className="h-5 w-5 text-dark-900" />
    </Dropdown>
  );
}
