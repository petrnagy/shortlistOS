import { t } from "@lingui/core/macro";
import { env } from "next-runtime-env";

import Button from "~/components/Button";
import FeedbackModal from "~/components/FeedbackModal";
import { FontSizeSelector } from "~/components/FontSizeSelector";
import Modal from "~/components/modal";
import { NewWorkspaceForm } from "~/components/NewWorkspaceForm";
import { PageHead } from "~/components/PageHead";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import Avatar from "./components/Avatar";
import { ChangePasswordFormConfirmation } from "./components/ChangePasswordConfirmation";
import { DeleteAccountConfirmation } from "./components/DeleteAccountConfirmation";
import UpdateDisplayNameForm from "./components/UpdateDisplayNameForm";

export default function AccountSettings() {
  const { modalContentType, openModal, isOpen } = useModal();
  const { showPopup } = usePopup();
  const isCredentialsEnabled =
    env("NEXT_PUBLIC_ALLOW_CREDENTIALS")?.toLowerCase() === "true";
  const { data } = api.user.getUser.useQuery();
  const exportDataQuery = api.user.exportData.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  const handleExportData = async () => {
    const result = await exportDataQuery.refetch().catch(() => null);

    if (!result?.data) {
      showPopup({
        header: t`Export failed`,
        message: t`We couldn't prepare your export. Please try again later.`,
        icon: "error",
      });

      return;
    }

    const json = JSON.stringify(result.data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `shortlistos-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showPopup({
      header: t`Export ready`,
      message: t`Your shortlistOS data export has started downloading.`,
      icon: "success",
    });
  };

  return (
    <>
      <PageHead title={t`Settings | Account`} />

      <div className="mb-8 border-t border-light-300 dark:border-dark-300">
        <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {t`Profile picture`}
        </h2>
        <Avatar userId={data?.id} userImage={data?.image} />

        <div className="mb-4">
          <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
            {t`Display name`}
          </h2>
          <UpdateDisplayNameForm displayName={data?.name ?? ""} />
        </div>

        <div className="mb-4">
          <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
            {t`Email`}
          </h2>
          <p className="text-sm text-neutral-700 dark:text-dark-900">
            {data?.email}
          </p>
        </div>

        <div className="mb-8 border-t border-light-300 dark:border-dark-300">
          <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
            {t`Font size`}
          </h2>
          <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
            {t`Change the application font size.`}
          </p>
          <FontSizeSelector />
        </div>

        {isCredentialsEnabled && (
          <div className="mb-8 border-t border-light-300 dark:border-dark-300">
            <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
              {data?.hasPassword ? t`Change Password` : t`Set Password`}
            </h2>
            <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
              {data?.hasPassword
                ? t`You are about to change your password.`
                : t`Set a password to enable password-based login.`}
            </p>
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => openModal("CHANGE_PASSWORD")}
              >
                {data?.hasPassword ? t`Change Password` : t`Set Password`}
              </Button>
            </div>
          </div>
        )}

        <div className="mb-8 border-y border-light-300 pb-8 dark:border-dark-300">
          <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
            {t`Export my data`}
          </h2>
          <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
            {t`Download a JSON file with your account details, shortlists, cards, comments, and attachment links.`}
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={handleExportData}
              isLoading={exportDataQuery.isFetching}
            >
              {t`Start download`}
            </Button>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-red-300 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/10">
          <div className="border-b border-red-200 px-4 py-3 dark:border-red-900/50">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
                {t`Delete account`}
              </h2>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                {t`Danger`}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-light-900 dark:text-dark-900">
              {t`Once you delete your account, there is no going back. This action cannot be undone.`}
            </p>
            <Button
              variant="secondary"
              onClick={() => openModal("DELETE_ACCOUNT")}
              className="border-red-300 text-red-700 shadow-none hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
            >
              {t`Delete account`}
            </Button>
          </div>
        </div>
      </div>

      {/* Account-specific modals */}
      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "DELETE_ACCOUNT"}
      >
        <DeleteAccountConfirmation />
      </Modal>
      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "CHANGE_PASSWORD"}
      >
        <ChangePasswordFormConfirmation
          hasPassword={data?.hasPassword ?? false}
        />
      </Modal>

      {/* Global modals */}
      <Modal
        modalSize="md"
        isVisible={isOpen && modalContentType === "NEW_FEEDBACK"}
      >
        <FeedbackModal />
      </Modal>
      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "NEW_WORKSPACE"}
      >
        <NewWorkspaceForm />
      </Modal>
    </>
  );
}
