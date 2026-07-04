import Link from "next/link";
import { t } from "@lingui/core/macro";
import { FaEnvelope, FaGithub, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

import { LanguageSelector } from "~/components/LanguageSelector";
import { env } from "~/env";

const githubUrl = env.NEXT_PUBLIC_GITHUB_URL ?? "#";
const xUrl = "https://x.com/petrnagy";
const linkedinUrl = "https://www.linkedin.com/in/petrnagy/";
const emailUrl = "mailto:petr@shortlistos.co";

function EuFlagIcon() {
  return (
    <svg
      aria-label={t`European Union`}
      role="img"
      viewBox="0 0 512 512"
      className="h-4 w-4 drop-shadow-[0_0_0.5px_rgba(0,0,0,0.45)]"
    >
      <circle cx="256" cy="256" r="256" fill="#294695" />
      {Array.from({ length: 12 }).map((_, index) => {
        const angle = (index * Math.PI) / 6;
        const cx = 256 + Math.sin(angle) * 168;
        const cy = 256 - Math.cos(angle) * 168;

        return (
          <text
            key={index}
            x={cx}
            y={cy}
            fill="#FFDA44"
            fontSize="58"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ★
          </text>
        );
      })}
    </svg>
  );
}

function CzechiaIcon() {
  return (
    <svg
      aria-label={t`Czechia`}
      role="img"
      viewBox="0 0 512 512"
      className="h-4 w-4 drop-shadow-[0_0_0.5px_rgba(0,0,0,0.45)]"
    >
      <defs>
        <clipPath id="czechia-heart">
          <path d="M471.7 73.7C417.7 19.7 330.3 19.7 276.3 73.7L256 94l-20.3-20.3c-54-54-141.4-54-195.4 0s-54 141.4 0 195.4L256 484.8l215.7-215.7c54-54 54-141.4 0-195.4z" />
        </clipPath>
      </defs>
      <g clipPath="url(#czechia-heart)">
        <rect width="512" height="256" fill="#F5F5F5" />
        <rect y="256" width="512" height="256" fill="#E4001B" />
        <path d="M0 0 256 256 0 512z" fill="#11457E" />
      </g>
    </svg>
  );
}

function VerticalPipe() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 h-4 border-l border-light-300 dark:border-dark-300"
    />
  );
}

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const socialLinks = [
    { label: t`GitHub`, href: githubUrl, icon: FaGithub },
    { label: t`X`, href: xUrl, icon: FaXTwitter },
    { label: t`LinkedIn`, href: linkedinUrl, icon: FaLinkedin },
    { label: t`Email`, href: emailUrl, icon: FaEnvelope },
  ];

  const groups = [
    {
      title: t`Product`,
      links: [
        { label: t`Features`, href: "/#product" },
        { label: t`Powerpack`, href: "/#powerpack" },
        { label: t`Pricing`, href: "/#pricing" },
      ],
    },
    {
      title: t`Resources`,
      links: [
        {
          label: t`GitHub`,
          href: githubUrl,
          external: true,
        },
        { label: t`FAQ`, href: "/#faq" },
        { label: t`Help`, href: "mailto:support@shortlistos.co" },
      ],
    },
    {
      title: t`Company`,
      links: [
        { label: t`Privacy`, href: "/privacy" },
        { label: t`Terms`, href: "/terms" },
        { label: t`Contact`, href: "mailto:petr@shortlistos.co" },
      ],
    },
  ];

  return (
    <footer className="relative z-10 border-t border-light-300 bg-light-50 dark:border-dark-300 dark:bg-dark-50">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-12 md:grid-cols-[1.2fr_2fr]">
        <div>
          <Link
            href="/"
            className="text-xl font-bold tracking-normal text-light-1000 dark:text-dark-1000"
          >
            shortlist<span className="font-medium">OS</span>
          </Link>
          <p className="mt-3 max-w-[260px] text-sm leading-[1.65rem] text-light-900 dark:text-dark-800">
            {t`Open-source job search CRM with optional automation for the repetitive parts.`}
          </p>
          <div className="mt-4 flex items-center gap-2">
            {socialLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  target={
                    link.href.startsWith("mailto:") ? undefined : "_blank"
                  }
                  rel={
                    link.href.startsWith("mailto:")
                      ? undefined
                      : "noopener noreferrer"
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-light-300 text-light-1000 hover:bg-light-100 dark:border-dark-300 dark:text-dark-1000 dark:hover:bg-dark-100"
                  aria-label={link.label}
                >
                  <Icon />
                </Link>
              );
            })}
          </div>
          <div className="mt-5">
            <LanguageSelector />
          </div>
        </div>

        <div>
          <div className="grid gap-8 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-bold text-light-1000 dark:text-dark-1000">
                  {group.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        className="text-sm text-light-900 hover:text-light-1000 dark:text-dark-800 dark:hover:text-dark-1000"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-light-300 dark:border-dark-300">
        <div className="mx-auto grid max-w-[1120px] gap-4 px-4 py-5 text-xs text-light-900 dark:text-dark-800 md:grid-cols-[1.2fr_2fr]">
          <p>
            © {currentYear} {t`Petr Nagy`}
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2 md:justify-end">
            <span>{t`Made in`}</span>
            <CzechiaIcon />
            <VerticalPipe />
            <span>{t`Hosted in`}</span>
            <EuFlagIcon />
            <VerticalPipe />
            <span>{t`No ads, no personal tracking, GDPR compliant.`}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
