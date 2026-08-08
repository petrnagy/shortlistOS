import Link from "next/link";
import { t } from "@lingui/core/macro";
import {
  HiOutlineArrowRight,
  HiOutlineBriefcase,
  HiOutlineCursorArrowRays,
  HiOutlineRectangleStack,
} from "react-icons/hi2";

import Button from "~/components/Button";
import { PageHead } from "~/components/PageHead";
import PaperGrainBackground from "~/components/PaperGrainBackground";

const steps = [
  {
    title: t`Create your first shortlist`,
    description: t`Use a shortlist for one job search, client pipeline, or focused group of opportunities.`,
    icon: HiOutlineRectangleStack,
  },
  {
    title: t`Add an opportunity`,
    description: t`Save the role, company, job posting, notes, and interview date in one place.`,
    icon: HiOutlineBriefcase,
  },
  {
    title: t`Keep it moving`,
    description: t`Move opportunities through each stage and always know what needs your attention next.`,
    icon: HiOutlineCursorArrowRays,
  },
] as const;

export default function GetStartedPage() {
  return (
    <>
      <PageHead title={t`Get started | shortlistOS`} />
      <main className="relative min-h-screen overflow-hidden bg-light-100 px-4 py-12 dark:bg-dark-50 sm:py-20">
        <div className="relative z-10 mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-light-1000 dark:text-dark-1000"
          >
            shortlistOS
          </Link>

          <section className="mt-16 text-center">
            <p className="text-brand-600 dark:text-brand-500 text-sm font-semibold uppercase tracking-widest">
              {t`Welcome aboard`}
            </p>
            <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold tracking-tight text-light-1000 dark:text-dark-1000 sm:text-5xl">
              {t`Turn your job search into a clear next step`}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-light-900 dark:text-dark-900">
              {t`shortlistOS keeps every opportunity, conversation, and milestone together so you can spend less time remembering and more time moving forward.`}
            </p>
          </section>

          <section className="mt-14 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className="rounded-xl border border-light-300 bg-light-50 p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-brand-600 dark:text-brand-500 text-sm font-semibold">
                      {index + 1}
                    </span>
                    <Icon className="h-6 w-6 text-light-800 dark:text-dark-800" />
                  </div>
                  <h2 className="mt-8 text-lg font-semibold text-light-1000 dark:text-dark-1000">
                    {step.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-light-900 dark:text-dark-900">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </section>

          <div className="mt-10 flex justify-center">
            <Button
              href="/boards"
              size="lg"
              iconRight={<HiOutlineArrowRight className="h-4 w-4" />}
            >
              {t`Open your workspace`}
            </Button>
          </div>
        </div>
        <PaperGrainBackground />
      </main>
    </>
  );
}
