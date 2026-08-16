import Link from "next/link";
import { t } from "@lingui/core/macro";
import { FaCheck, FaInfoCircle } from "react-icons/fa";

import { Tooltip } from "~/components/Tooltip";
import { POWERPACK_PRICE } from "~/config/pricing";
import { env } from "~/env";

export interface PricingPlan {
  title: string;
  price: string;
  detail?: string;
  description?: string;
  cta: string;
  href: string;
  featured: boolean;
  compactPrice?: boolean;
  dynamicBackground?: boolean;
  badge?: string;
  note?: string;
  items: {
    label: string;
    info?: string;
  }[];
}

const powerpackSignupHref = "/signup?withPowerpack=yes";
const githubUrl = env.NEXT_PUBLIC_GITHUB_URL ?? "#";

export function getPricingPlans(): PricingPlan[] {
  return [
    {
      title: t`Free`,
      price: t`$0`,
      detail: t`forever`,
      description: t`The hosted base version, without Powerpack.`,
      cta: t`Create free account`,
      href: "/signup",
      featured: false,
      items: [
        { label: t`Unlimited shortlists` },
        { label: t`Unlimited opportunities` },
        { label: t`Job-search pipeline` },
        { label: t`Notes and attachments` },
        { label: t`Activity history` },
        { label: t`Full data export` },
      ],
    },
    {
      title: t`Powerpack`,
      price: POWERPACK_PRICE,
      detail: t`One-time payment`,
      cta: t`Get the Powerpack`,
      href: powerpackSignupHref,
      featured: true,
      dynamicBackground: true,
      badge: t`Recommended`,
      items: [
        {
          label: t`Magic Inbox`,
          info: t`Email jobs and job updates to your account. Magic Inbox AI will automatically create or update your job opportunities.`,
        },
        {
          label: t`Job posting Web Clipper`,
          info: t`Grab any interesting job opening on the internet, and send it to your shortlist without manually copy-pasting anything.`,
        },
        { label: t`Company rating snapshot` },
        { label: t`Salary insights for each job` },
        { label: t`Automatic reminders and nudges` },
        {
          label: t`Google calendar`,
          info: t`A private calendar feed for scheduled interviews, compatible with Google Calendar, Outlook, and other calendar apps.`,
        },
        { label: t`Weekly digest` },
      ],
    },
    {
      title: t`Self-hosted`,
      price: t`Open source`,
      description: t`Run the base version on your own infrastructure.`,
      cta: t`View on GitHub`,
      href: githubUrl,
      compactPrice: true,
      featured: false,
      items: [
        { label: t`Full source code` },
        { label: t`Your own hosting and database` },
        { label: t`Full control over your data` },
        { label: t`No hosted account required` },
        { label: t`You manage setup, updates, backups` },
        { label: t`All the features` },
      ],
    },
  ];
}

export function PricingCards({ plans }: { plans: PricingPlan[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((plan) => (
        <div
          key={plan.title}
          className={`relative flex min-h-[420px] flex-col rounded-2xl border p-6 shadow-sm ${
            plan.featured
              ? "border-brand-300 dark:border-brand-500/50 bg-light-50 shadow-[0_16px_50px_rgba(124,58,237,0.18)] dark:bg-dark-100"
              : "border-light-300 bg-light-50 dark:border-dark-300 dark:bg-dark-100"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-light-1000 dark:text-dark-1000">
              {plan.title}
            </h3>
            {plan.badge && (
              <span className="bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 rounded-full px-3 py-1 text-xs font-semibold">
                {plan.badge}
              </span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
            <span
              className={`font-bold leading-[1.1] text-light-1000 dark:text-dark-1000 ${
                plan.compactPrice ? "text-3xl" : "text-4xl"
              }`}
            >
              {plan.price}
            </span>
            {plan.detail ? (
              <span className="pb-1 text-sm leading-[1.55] text-light-900 dark:text-dark-800">
                {plan.detail}
              </span>
            ) : null}
          </div>
          {plan.description ? (
            <p className="mt-4 text-sm leading-[1.65] text-light-900 dark:text-dark-800">
              {plan.description}
            </p>
          ) : null}
          <ul className="mt-6 space-y-3 pb-6">
            {plan.items.map((item) => (
              <li
                key={item.label}
                className="flex gap-3 text-sm leading-[1.55rem] text-light-950 dark:text-dark-900"
              >
                <FaCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {item.info ? (
                    <Tooltip content={item.info} placement="top">
                      <span
                        className="inline-flex cursor-help text-light-800 dark:text-dark-800"
                        aria-label={item.info}
                        title={item.info}
                      >
                        <FaInfoCircle className="h-3 w-3" />
                      </span>
                    </Tooltip>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <PricingButton
            href={plan.href}
            variant={plan.featured ? "primary" : "secondary"}
            className="mt-auto w-full"
            external={plan.href.startsWith("http")}
            dynamicBackground={plan.dynamicBackground}
          >
            {plan.cta}
          </PricingButton>
          {plan.note ? (
            <p className="mt-3 text-center text-xs font-medium text-light-900 dark:text-dark-800">
              {plan.note}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PricingButton({
  href,
  variant,
  children,
  className = "",
  external = false,
  dynamicBackground = false,
}: {
  href: string;
  variant: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
  external?: boolean;
  dynamicBackground?: boolean;
}) {
  const classes =
    variant === "primary"
      ? `rounded-lg px-5 py-3 text-sm font-bold text-white shadow-lg shadow-black/20 transition ${
          dynamicBackground
            ? "landing-powerpack-cta hover:brightness-110"
            : "bg-brand-600 hover:bg-brand-500"
        }`
      : "rounded-lg border border-light-400 bg-light-50 px-5 py-3 text-sm font-bold text-light-1000 shadow-sm transition hover:bg-light-100 dark:border-dark-400 dark:bg-dark-100 dark:text-dark-1000 dark:hover:bg-dark-200";

  return (
    <>
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={`inline-flex items-center justify-center text-center ${classes} ${className}`}
      >
        {children}
      </Link>
      {dynamicBackground && (
        <style jsx global>{`
          .landing-powerpack-cta {
            background: linear-gradient(
              -45deg,
              #06b6d4,
              #e73c7e,
              #ee7752,
              #10b981
            );
            background-size: 400% 400%;
            animation: landing-powerpack-gradient 6s ease infinite;
          }

          @keyframes landing-powerpack-gradient {
            0% {
              background-position: 0% 50%;
            }

            50% {
              background-position: 100% 50%;
            }

            100% {
              background-position: 0% 50%;
            }
          }
        `}</style>
      )}
    </>
  );
}
