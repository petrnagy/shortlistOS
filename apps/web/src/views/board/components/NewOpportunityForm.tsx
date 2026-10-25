import Link from "next/link";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiXMark } from "react-icons/hi2";

import { Alert } from "~/components/Alert";
import { useModal } from "~/providers/modal";
import { api } from "~/utils/api";
import { hasActivePowerpack } from "~/utils/powerpack";
import { NewCardForm } from "./NewCardForm";
import { SavedFileUploadForm } from "./SavedFileUploadForm";

export function NewOpportunityForm(
  props: React.ComponentProps<typeof NewCardForm>,
) {
  const { data: user, isLoading } = api.user.getUser.useQuery();
  const canImport = hasActivePowerpack(user);
  const [busy, setBusy] = useState(false);
  const { closeModal } = useModal();

  return (
    <TabGroup>
      <button
        type="button"
        aria-label={t`Close`}
        className="absolute right-3 top-3 rounded p-1 hover:bg-light-200 focus:outline-none dark:hover:bg-dark-300"
        onClick={() => closeModal()}
        disabled={busy}
      >
        <HiXMark size={18} className="text-light-900 dark:text-dark-900" />
      </button>
      <TabList
        aria-label={t`Add opportunity`}
        className="mx-5 mt-12 flex gap-1 rounded-lg bg-light-200 p-1 dark:bg-dark-200"
      >
        {[t`Manual`, t`Upload`, t`Link`, t`Text`].map((label) => (
          <Tab
            key={label}
            disabled={busy}
            className="focus-visible:outline-brand-500 flex-1 rounded-md px-2 py-2 text-sm text-light-900 data-[selected]:bg-white data-[selected]:text-light-1000 data-[selected]:shadow-sm focus-visible:outline focus-visible:outline-2 dark:text-dark-900 dark:data-[selected]:bg-dark-400 dark:data-[selected]:text-dark-1000"
          >
            {label}
          </Tab>
        ))}
      </TabList>
      <TabPanels>
        <TabPanel unmount={false}>
          <NewCardForm {...props} />
        </TabPanel>
        {(["upload", "link", "text"] as const).map((method) => (
          <TabPanel key={method} unmount={false}>
            {canImport ? (
              <SavedFileUploadForm
                boardPublicId={props.boardPublicId}
                listPublicId={props.listPublicId}
                method={method}
                onBusyChange={setBusy}
              />
            ) : (
              <div className="p-5">
                <Alert>
                  {isLoading ? (
                    t`Loading...`
                  ) : (
                    <>
                      {t`Get the Powerpack to automate your job search.`}{" "}
                      <Link
                        href="/settings/powerpack"
                        className="font-semibold underline"
                      >{t`Upgrade now`}</Link>
                    </>
                  )}
                </Alert>
              </div>
            )}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}
