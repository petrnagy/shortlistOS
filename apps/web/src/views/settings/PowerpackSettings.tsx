import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { loadStripe } from "@stripe/stripe-js";
import { intervalToDuration } from "date-fns";
import { env } from "next-runtime-env";
import { useCallback, useEffect, useRef, useState } from "react";
import { HiCheck } from "react-icons/hi2";

import { authClient } from "@kan/auth/client";

import { Alert } from "~/components/Alert";
import Button from "~/components/Button";
import { PageHead } from "~/components/PageHead";
import { POWERPACK_PRICE } from "~/config/pricing";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { hasActivePowerpack } from "~/utils/powerpack";

interface FeatureRow {
  label: string;
  inFree: boolean;
  inPowerpack: boolean;
}

interface StripeCheckoutClient {
  redirectToCheckout: (options: {
    sessionId: string;
  }) => Promise<{ error?: Error }>;
}

const POWERPACK_INTENT_STORAGE_KEY = "shortlist_with_powerpack";
const POWERPACK_CHECKOUT_COMPLETED_STORAGE_KEY =
  "shortlist_powerpack_checkout_completed";

const formatPowerpackRemainingTime = (expiresAt: Date) => {
  const now = new Date();

  if (expiresAt <= now) return t`a little while`;

  const duration = intervalToDuration({ start: now, end: expiresAt });
  const parts: string[] = [];

  if (duration.months) {
    parts.push(
      duration.months === 1
        ? t`1 month`
        : t`${duration.months} months`,
    );
  }

  if (duration.days) {
    parts.push(duration.days === 1 ? t`1 day` : t`${duration.days} days`);
  }

  if (duration.hours) {
    parts.push(duration.hours === 1 ? t`1 hour` : t`${duration.hours} hours`);
  }

  if (!parts.length) {
    return t`less than 1 hour`;
  }

  if (parts.length === 1) return parts[0] ?? t`less than 1 hour`;
  if (parts.length === 2) return t`${parts[0]} and ${parts[1]}`;

  const lastPart = parts[parts.length - 1];

  if (!lastPart) return parts.join(", ");

  return t`${parts.slice(0, -1).join(", ")}, and ${lastPart}`;
};

const featureGroups: { title: string; items: FeatureRow[] }[] = [
  {
    title: t`Your job search at a glance`,
    items: [
      {
        label: t`Job hunting workspace with drag-and-drop pipeline`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Unlimited shortlists`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Unlimited opportunities per shortlist`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Activity timeline per opportunity`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Notes and file attachments`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Card fields: company, role, interview date, contacts`,
        inFree: true,
        inPowerpack: true,
      },
    ],
  },
  {
    title: t`Capturing opportunities`,
    items: [
      {
        label: t`Save jobs in one click with the browser web clipper`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Magic Inbox: forward any job email and auto-create or update cards`,
        inFree: false,
        inPowerpack: true,
      },
    ],
  },
  {
    title: t`Salary and company intelligence`,
    items: [
      {
        label: t`Automatic salary range for your target role`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Location-aware salary data: your country, EU, and US`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Salary percentile benchmarks: EU, US, and global`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Automatic company sentiment from Glassdoor and social channels`,
        inFree: false,
        inPowerpack: true,
      },
    ],
  },
  {
    title: t`Automations and nudges`,
    items: [
      {
        label: t`Card aging: visual staleness on inactive opportunities`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Google Calendar sync for interviews and follow-ups`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Email reminders for upcoming interviews and next actions`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Auto-move to ghosted after silence in Applied`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Follow-up nudge when a company goes quiet`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Reminder when a saved opportunity sits untouched too long`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Auto-archive stale saved opportunities`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Nudges when interviews or negotiations lose momentum`,
        inFree: false,
        inPowerpack: true,
      },
      {
        label: t`Weekly digest: what needs your attention right now`,
        inFree: false,
        inPowerpack: true,
      },
    ],
  },
  {
    title: t`Privacy and data`,
    items: [
      {
        label: t`No tracking, no ads, GDPR aligned`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Full data download anytime`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`Made and hosted in the EU`,
        inFree: true,
        inPowerpack: true,
      },
      {
        label: t`CSV export`,
        inFree: true,
        inPowerpack: true,
      },
    ],
  },
];

export default function PowerpackSettings() {
  const router = useRouter();
  const { showPopup } = usePopup();
  const { data: session } = authClient.useSession();
  const { data: user } = api.user.getUser.useQuery(undefined, {
    enabled: !!session?.user.id,
  });
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [hasPowerpackIntent, setHasPowerpackIntent] = useState(false);
  const [hasCompletedPowerpackCheckout, setHasCompletedPowerpackCheckout] =
    useState(false);
  const autoCheckoutStartedRef = useRef(false);
  const userHasActivePowerpack = hasActivePowerpack(user);
  const formattedPowerpackExpiry = user?.shortlistPowerpackExpiresAt
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(user.shortlistPowerpackExpiresAt)
    : null;
  const remainingPowerpackTime =
    userHasActivePowerpack && user?.shortlistPowerpackExpiresAt
      ? formatPowerpackRemainingTime(user.shortlistPowerpackExpiresAt)
      : null;
  const loadStripeSafe = loadStripe as unknown as (
    publishableKey: string,
  ) => Promise<StripeCheckoutClient | null>;

  useEffect(() => {
    if (!router.isReady) return;

    const queryWithPowerpack = Array.isArray(router.query.withPowerpack)
      ? router.query.withPowerpack[0]
      : router.query.withPowerpack;
    const hasQueryIntent = queryWithPowerpack === "yes";
    const hasStoredIntent =
      sessionStorage.getItem(POWERPACK_INTENT_STORAGE_KEY) === "yes";

    if (hasQueryIntent) {
      sessionStorage.setItem(POWERPACK_INTENT_STORAGE_KEY, "yes");
    }

    setHasPowerpackIntent(hasQueryIntent || hasStoredIntent);
    setHasCompletedPowerpackCheckout(
      sessionStorage.getItem(POWERPACK_CHECKOUT_COMPLETED_STORAGE_KEY) ===
        "yes",
    );
  }, [router.isReady, router.query.withPowerpack]);

  const handleCheckout = useCallback(async () => {
    if (!session?.user.id) {
      const nextPath = hasPowerpackIntent
        ? "/settings/powerpack?withPowerpack=yes"
        : "/settings/powerpack";

      await router.push(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const publishableKey = env("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

    if (!publishableKey) {
      showPopup({
        icon: "error",
        header: t`Stripe is not configured`,
        message: t`Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable.`,
      });
      return;
    }

    setIsCheckoutLoading(true);

    try {
      const stripe = await loadStripeSafe(publishableKey);

      if (!stripe) {
        throw new Error("Unable to initialize Stripe");
      }

      const response = await fetch(
        "/api/shortlist_stripe/create_checkout_session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            withPowerpack: hasPowerpackIntent ? "yes" : "no",
          }),
        },
      );

      const payload = (await response.json()) as {
        sessionId?: string;
        error?: string;
        loginUrl?: string;
      };

      if (response.status === 401 && payload.loginUrl) {
        await router.push(payload.loginUrl);
        return;
      }

      if (!response.ok || !payload.sessionId) {
        throw new Error(payload.error ?? "Unable to create checkout session");
      }

      const result = await stripe.redirectToCheckout({
        sessionId: payload.sessionId,
      });

      if (result.error) {
        throw result.error;
      }
    } catch (error) {
      showPopup({
        icon: "error",
        header: t`Checkout error`,
        message:
          error instanceof Error
            ? error.message
            : t`Unable to start checkout right now. Please try again.`,
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  }, [hasPowerpackIntent, loadStripeSafe, router, session?.user.id, showPopup]);

  useEffect(() => {
    if (!router.isReady || !hasPowerpackIntent || !session?.user.id || !user) {
      return;
    }

    if (userHasActivePowerpack) {
      sessionStorage.removeItem(POWERPACK_INTENT_STORAGE_KEY);
      sessionStorage.removeItem(POWERPACK_CHECKOUT_COMPLETED_STORAGE_KEY);
      void router.replace("/boards");
      return;
    }

    if (
      hasCompletedPowerpackCheckout ||
      isCheckoutLoading ||
      autoCheckoutStartedRef.current
    ) {
      return;
    }

    autoCheckoutStartedRef.current = true;
    void handleCheckout();
  }, [
    handleCheckout,
    hasCompletedPowerpackCheckout,
    hasPowerpackIntent,
    isCheckoutLoading,
    router,
    router.isReady,
    session?.user.id,
    user,
    userHasActivePowerpack,
  ]);

  return (
    <>
      <PageHead title={t`Settings | Powerpack`} />
      <div className="mb-8 border-t border-light-300 dark:border-dark-300">
        <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {t`The Powerpack`}
        </h2>
        {remainingPowerpackTime && (
          <Alert
            variant="success"
            title={t`Powerpack active`}
            className="mb-6"
          >
            {t`You are currently enjoying the full power of the Powerpack, and will continue to enjoy it for another ${remainingPowerpackTime}.`}
          </Alert>
        )}
        <p className="mb-3 text-sm text-neutral-500 dark:text-dark-900">
          {t`shortlistOS tracks your job search.`}
          <b>{t`The Powerpack runs it for you.`}</b>
          <br />
          {t`One-time payment of ${POWERPACK_PRICE} gets you 3 months of full access. No subscription. Job hunting is stressful enough already.`}
        </p>
        <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
          {t`After 3 months, Powerpack features pause — but nothing disappears. Every opportunity, note, salary insight, and card stays exactly where it is. Continue your job hunt without it, or purchase another 3 months if you need the magic back. No automatic charges, ever.`}
        </p>

        <div className="overflow-x-auto rounded-md border border-light-300 bg-light-50 dark:border-dark-300 dark:bg-dark-100">
          <table className="min-w-full table-fixed divide-y divide-light-600 text-left text-sm dark:divide-dark-600">
            <thead className="bg-light-300 dark:bg-dark-300">
              <tr>
                <th className="w-1/2 rounded-tl-lg px-4 py-3 text-left text-xs font-semibold tracking-wide text-light-900 dark:text-dark-900">
                  {t`Feature`}
                </th>
                <th className="w-1/4 px-4 py-3 text-center text-xs font-semibold tracking-wide text-light-900 dark:text-dark-900">
                  {t`shortlistOS`}
                </th>
                <th className="w-1/4 rounded-tr-lg px-4 py-3 text-center text-xs font-semibold tracking-wide text-light-900 dark:text-dark-900">
                  {t`shortlistOS + Powerpack ⚡`}
                </th>
              </tr>
            </thead>

            {featureGroups.map((group) => (
              <tbody
                key={group.title}
                className="divide-y divide-light-600 bg-light-50 dark:divide-dark-600 dark:bg-dark-100"
              >
                <tr className="bg-light-100 dark:bg-dark-200">
                  <td
                    colSpan={3}
                    className="px-4 py-2 text-xs font-semibold tracking-wide text-light-900 dark:text-dark-900"
                  >
                    {group.title}
                  </td>
                </tr>
                {group.items.map((feature) => (
                  <tr key={feature.label}>
                    <td className="px-4 py-2 text-sm text-light-900 dark:text-dark-900">
                      {feature.label}
                    </td>
                    <td className="px-4 py-2 text-center align-middle">
                      {feature.inFree ? (
                        <HiCheck
                          className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="text-light-700 dark:text-dark-800">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center align-middle">
                      {feature.inPowerpack ? (
                        <HiCheck
                          className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="text-light-700 dark:text-dark-800">
                          -
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}

            <tfoot className="bg-light-100 dark:bg-dark-200">
              <tr>
                <td className="px-4 py-3" aria-hidden="true" />
                <td className="px-4 py-3 text-center text-sm font-medium text-light-900 dark:text-dark-900">
                  {t`Already got it!`}
                </td>
                <td className="px-4 py-3 text-center">
                  {userHasActivePowerpack && formattedPowerpackExpiry ? (
                    <span className="text-sm font-medium text-light-900 dark:text-dark-900">
                      {t`Active until ${formattedPowerpackExpiry}`}
                    </span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isCheckoutLoading}
                      onClick={handleCheckout}
                      className="powerpack-cta-gradient text-light-50 dark:text-light-50"
                      style={{
                        background:
                          "linear-gradient(-45deg, #06B6D4, #e73c7e, #ee7752, #10B981)",
                        backgroundSize: "400% 400%",
                      }}
                    >
                      {t`3 months for ${POWERPACK_PRICE}`}
                    </Button>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
          <style jsx global>{`
            .powerpack-cta-gradient {
              animation: powerpack-cta-gradient 6s ease infinite;
            }

            @keyframes powerpack-cta-gradient {
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
        </div>
      </div>
    </>
  );
}
