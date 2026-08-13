import Link from "next/link";
import { t } from "@lingui/core/macro";

const primaryCta = t`Get the Powerpack`;
const secondaryCta = t`Create free account`;
const powerpackSignupHref = "/signup?withPowerpack=yes";

export default function FinalCta() {
  return (
    <section className="px-4 py-20 text-center">
      <div className="mx-auto max-w-[680px]">
        <h2 className="mt-3 text-4xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-5xl">
          {t`Stop managing your job search from memory.`}
        </h2>
        <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
          {t`Keep every opportunity organized and let Powerpack handle the repetitive parts.`}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start">
          <div className="flex w-full flex-col items-center sm:w-44">
            <CtaButton href="/signup" variant="secondary" className="w-full">
              {secondaryCta}
            </CtaButton>
          </div>
          <div className="flex w-full flex-col items-center sm:w-44">
            <CtaButton
              href={powerpackSignupHref}
              variant="primary"
              dynamicBackground
              className="w-full"
            >
              {primaryCta}
            </CtaButton>
            <p className="mt-2 text-xs leading-5 text-light-900 dark:text-dark-800">
              {t`3 months for $29 · No recurring payments`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaButton({
  href,
  variant,
  children,
  className = "",
  dynamicBackground = false,
}: {
  href: string;
  variant: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
  dynamicBackground?: boolean;
}) {
  const classes =
    variant === "primary"
      ? `h-11 rounded-lg border border-transparent px-5 text-sm font-bold text-white shadow-lg shadow-black/20 transition ${
          dynamicBackground
            ? "landing-powerpack-cta hover:brightness-110"
            : "bg-brand-600 hover:bg-brand-500"
        }`
      : "h-11 rounded-lg border border-light-400 bg-light-50 px-5 text-sm font-bold text-light-1000 shadow-sm transition hover:bg-light-100 dark:border-dark-400 dark:bg-dark-100 dark:text-dark-1000 dark:hover:bg-dark-200";

  return (
    <>
      <Link
        href={href}
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
