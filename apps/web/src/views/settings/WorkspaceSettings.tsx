import { t } from "@lingui/core/macro";

import Button from "~/components/Button";
import FeedbackModal from "~/components/FeedbackModal";
import Modal from "~/components/modal";
import { NewWorkspaceForm } from "~/components/NewWorkspaceForm";
import { PageHead } from "~/components/PageHead";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import { isSuperAdmin as isSuperAdminHelper } from "~/utils/is-super-admin";
import { DeleteWorkspaceConfirmation } from "./components/DeleteWorkspaceConfirmation";
import UpdateWeekStartDayForm from "./components/UpdateWeekStartDayForm";
import UpdateWorkspaceDescriptionForm from "./components/UpdateWorkspaceDescriptionForm";
import UpdateWorkspaceEmailVisibilityForm from "./components/UpdateWorkspaceEmailVisibilityForm";
import UpdateWorkspaceNameForm from "./components/UpdateWorkspaceNameForm";
import UpdateWorkspaceUrlForm from "./components/UpdateWorkspaceUrlForm";

export default function WorkspaceSettings() {
  const { modalContentType, openModal, isOpen } = useModal();
  const { workspace } = useWorkspace();
  const { canEditWorkspace } = usePermissions();
  const isSuperAdmin = isSuperAdminHelper();
  const { data: workspaceData } = api.workspace.byId.useQuery(
    { workspacePublicId: workspace.publicId },
    { enabled: !!workspace.publicId && workspace.publicId.length >= 12 },
  );

  return (
    <>
      <PageHead title={t`Settings | Workspace`} />

      <div className="mb-8 border-t border-light-300 dark:border-dark-300">
        <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {t`Workspace name`}
        </h2>
        <UpdateWorkspaceNameForm
          workspacePublicId={workspace.publicId}
          workspaceName={workspace.name}
          disabled={!canEditWorkspace}
        />

        {isSuperAdmin && (
          <div>
            <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
              {t`Workspace URL`}
            </h2>
            <UpdateWorkspaceUrlForm
              workspacePublicId={workspace.publicId}
              workspaceUrl={workspace.slug ?? ""}
              workspacePlan={workspace.plan ?? "free"}
              disabled={!canEditWorkspace}
            />
          </div>
        )}

        {isSuperAdmin && (
          <div>
            <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
              {t`Workspace description`}
            </h2>
            <UpdateWorkspaceDescriptionForm
              workspacePublicId={workspace.publicId}
              workspaceDescription={workspace.description ?? ""}
              disabled={!canEditWorkspace}
            />
          </div>
        )}

        <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {t`Week start day`}
        </h2>
        <UpdateWeekStartDayForm
          workspacePublicId={workspace.publicId}
          weekStartDay={workspaceData?.weekStartDay ?? 1}
          disabled={!canEditWorkspace}
        />

        {isSuperAdmin && (
          <div>
            <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
              {t`Email visibility`}
            </h2>
            <UpdateWorkspaceEmailVisibilityForm
              workspacePublicId={workspace.publicId}
              showEmailsToMembers={Boolean(
                workspaceData?.showEmailsToMembers ?? false,
              )}
              disabled={!canEditWorkspace}
            />
          </div>
        )}

        <div className="mt-8 rounded-lg border border-red-300 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/10">
          <div className="border-b border-red-200 px-4 py-3 dark:border-red-900/50">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
                {t`Delete workspace`}
              </h2>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                {t`Danger`}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-light-900 dark:text-dark-900">
              {t`Once you delete your workspace, there is no going back. This action cannot be undone.`}
            </p>
            <Button
              variant="secondary"
              onClick={() => openModal("DELETE_WORKSPACE")}
              disabled={!isSuperAdmin}
              className="border-red-300 text-red-700 shadow-none hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
            >
              {t`Delete workspace`}
            </Button>
          </div>
        </div>
      </div>

      {/* Workspace-specific modals */}
      <Modal
        modalSize="sm"
        isVisible={isOpen && modalContentType === "DELETE_WORKSPACE"}
      >
        <DeleteWorkspaceConfirmation />
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
