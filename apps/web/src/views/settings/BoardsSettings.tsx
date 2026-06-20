import Link from "next/link";
import { t } from "@lingui/core/macro";
import { HiOutlineShieldCheck } from "react-icons/hi2";

import Toggle from "~/components/Toggle";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { hasActivePowerpack } from "~/utils/powerpack";

interface BoardsSettingsProps {
  boardPublicId: string;
  isBoardLoaded: boolean;
  isCardAgingEnabled: boolean;
}

const BoardsSettings = ({
  boardPublicId,
  isBoardLoaded,
  isCardAgingEnabled,
}: BoardsSettingsProps) => {
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const { data: user } = api.user.getUser.useQuery();
  const userHasActivePowerpack = hasActivePowerpack(user);

  const updateBoard = api.board.update.useMutation({
    onError: (error) => {
      showPopup({
        header: t`Unable to update board`,
        message:
          error.message || t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSuccess: async () => {
      await utils.board.byId.invalidate({ boardPublicId });
    },
  });

  const isDisabled =
    !boardPublicId ||
    !isBoardLoaded ||
    !userHasActivePowerpack ||
    updateBoard.isPending;

  const handleCardAgingToggle = () => {
    if (isDisabled) return;

    updateBoard.mutate({
      boardPublicId,
      shortlistIsCardAgingEnabled: !isCardAgingEnabled,
    });
  };

  return (
    <section className="mb-8 border-t border-light-300 pt-8 dark:border-dark-300">
      <div className="mb-4 flex items-center gap-2">
        <HiOutlineShieldCheck className="h-5 w-5 text-light-900 dark:text-dark-900" />
        <h2 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
          {t`Automation`}
        </h2>
      </div>

      {!userHasActivePowerpack && (
        <p className="mb-4 rounded-[8px] border border-light-300 bg-light-100 px-4 py-3 text-sm leading-6 text-light-800 dark:border-dark-300 dark:bg-dark-100 dark:text-dark-900">
          {t`Get the Powerpack to automate your job search.`}{" "}
          <Link
            href="/settings/powerpack"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-500"
          >
            {t`Upgrade now`}
          </Link>
        </p>
      )}

      <div className="rounded-[8px] border border-light-300 p-5 dark:border-dark-300">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
              {t`Card aging`}
            </p>
            <span className="mt-3 inline-flex items-center rounded-[5px] bg-light-200 px-2 py-1 text-sm font-medium text-light-900 dark:bg-dark-200 dark:text-dark-900">
              {isCardAgingEnabled ? t`Enabled` : t`Disabled`}
            </span>
          </div>
          <Toggle
            isChecked={isCardAgingEnabled}
            onChange={handleCardAgingToggle}
            label={t`Card aging`}
            disabled={isDisabled}
            showLabel={false}
          />
        </div>
        <p className="text-sm leading-6 text-light-700 dark:text-dark-800">
          {t`Show visual aging effects on cards based on last activity. Cards older than 1 week show progressive aging from faded to parchment style.`}
        </p>
      </div>
    </section>
  );
};

export default BoardsSettings;
