import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";

import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import { PageHead } from "~/components/PageHead";
import Popup from "~/components/Popup";
import { api } from "~/utils/api";
import BoardsSettings from "~/views/settings/BoardsSettings";

const BoardSettingsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const boardId =
    typeof router.query.boardId === "string" ? router.query.boardId : null;

  const { data: boardData } = api.board.byId.useQuery(
    { boardPublicId: boardId ?? "" },
    { enabled: !!boardId },
  );

  const shortlistName = boardData?.name ?? t`Shortlist`;

  return (
    <>
      <PageHead title={t`${shortlistName} settings`} />
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="h-full max-h-[calc(100vdh-3rem)] overflow-y-auto md:max-h-[calc(100vdh-4rem)]">
          <div className="m-auto max-w-[1100px] px-5 py-6 md:px-28 md:py-12">
            <div className="mb-8 flex w-full justify-between">
              <h1 className="font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
                {t`${shortlistName} settings`}
              </h1>
            </div>

            <BoardsSettings
              boardPublicId={boardId ?? ""}
              isBoardLoaded={!!boardData}
              isCardAgingEnabled={
                boardData?.shortlistIsCardAgingEnabled ?? false
              }
            />
          </div>
        </div>
      </div>
      <Popup />
    </>
  );
};

BoardSettingsPage.getLayout = (page) => getDashboardLayout(page);

export default BoardSettingsPage;
