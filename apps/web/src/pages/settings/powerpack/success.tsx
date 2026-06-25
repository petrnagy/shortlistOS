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
      return;
    }

    const withPowerpack = Array.isArray(router.query.withPowerpack)
      ? router.query.withPowerpack[0]
      : router.query.withPowerpack;

    if (withPowerpack === "yes") {
      sessionStorage.setItem("shortlist_with_powerpack", "yes");
      sessionStorage.setItem("shortlist_powerpack_checkout_completed", "yes");
      void router.replace("/settings/powerpack?withPowerpack=yes");
    }
  }, [
    router,
    router.isReady,
    router.query.session_id,
    router.query.withPowerpack,
  ]);

  return (
    <SettingsLayout currentTab="powerpack">
      <PageHead title={t`Settings | Powerpack purchase success`} />
      <div className="mb-8 border-t border-light-300 pt-8 dark:border-dark-300">
        <h2 className="mb-3 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {t`Powerpack unlocked`}
        </h2>
        <p className="mb-6 text-sm text-neutral-500 dark:text-dark-900">
          {t`You're all set! Your account now has Powerpack features enabled and ready to go.`}
        </p>
        <Button href="/boards" variant="primary" size="sm">
          {t`Continue job hunting with Powerpack`}
        </Button>
      </div>
    </SettingsLayout>
  );
};

PowerpackSuccessPage.getLayout = (page) => getDashboardLayout(page);

export default PowerpackSuccessPage;
