import { t } from "@lingui/core/macro";

import { PageHead } from "~/components/PageHead";
import FinalCta from "../home/components/FinalCta";
import Layout from "../home/components/Layout";
import { FeatureComparisonTable } from "./components/FeatureComparisonTable";
import { getPricingPlans, PricingCards } from "./components/PricingCards";

export default function PricingView() {
  const pricingPlans = getPricingPlans();

  return (
    <Layout>
      <PageHead title={t`Pricing | shortlistOS`} />
      <div className="mb-20">
        <section id="pricing" className="scroll-mt-20 px-4 pb-14 pt-28">
          <div className="mx-auto max-w-[980px]">
            <div className="mx-auto max-w-[680px] text-center">
              <p className="bg-brand-600 inline-flex rounded-full px-3 py-1 text-sm font-semibold text-white">
                {t`Pricing`}
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
                {t`Use shortlistOS your way.`}
              </h1>
              <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
                {t`Choose Powerpack for automation, use the full workspace for free, or self-host the open-source core.`}
              </p>
            </div>

            <div className="mt-10">
              <PricingCards plans={pricingPlans} />
            </div>
          </div>
        </section>

        <section id="compare-features" className="scroll-mt-24 px-4 py-14">
          <div className="mx-auto max-w-[980px]">
            <div className="mx-auto mb-8 max-w-[680px] text-center">
              <h2 className="text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
                {t`Compare features`}
              </h2>
              <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
                {t`See what is included in the free base version and what Powerpack adds for automation, reminders, salary insight, and company research.`}
              </p>
            </div>
            <FeatureComparisonTable />
          </div>
        </section>
        <FinalCta />
      </div>
    </Layout>
  );
}
