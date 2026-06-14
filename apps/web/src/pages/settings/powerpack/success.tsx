import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { useEffect } from "react";

import type { NextPageWithLayout } from "~/pages/_app";
import Button from "~/components/Button";
import { getDashboardLayout } from "~/components/Dashboard";
import { PageHead } from "~/components/PageHead";
import { SettingsLayout } from "~/components/SettingsLayout";

const PowerpackSuccessPage: NextPageWithLayout = () => {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    const sessionId = Array.isArray(router.query.session_id)
      ? router.query.session_id[0]
      : router.query.session_id;

    if (!sessionId) {
      void router.replace("/settings/powerpack");
    }
  }, [router, router.isReady, router.query.session_id]);

  return (
    <SettingsLayout currentTab="powerpack">
      <PageHead title={t`Settings | Powerpack purchase success`} />
      <div className="mb-8 border-t border-light-300 pt-8 dark:border-dark-300">
        <h2 className="mb-3 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {t`Purchase complete`}
        </h2>
        <p className="mb-6 text-sm text-neutral-500 dark:text-dark-900">
          {t`Thanks for your purchase. Your Powerpack access is being activated now.`}
        </p>
        <Button href="/settings/powerpack" variant="primary" size="sm">
          {t`Back to Powerpack settings`}
        </Button>
      </div>
    </SettingsLayout>
  );
};

PowerpackSuccessPage.getLayout = (page) => getDashboardLayout(page);

export default PowerpackSuccessPage;
