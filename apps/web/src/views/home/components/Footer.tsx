import Link from "next/link";
import { t } from "@lingui/core/macro";
import { FaGithub } from "react-icons/fa";

import { LanguageSelector } from "~/components/LanguageSelector";

const Footer = () => {
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
          href: "https://github.com/petrnagy/shortlistOS",
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
          <Link
            href="https://github.com/petrnagy/shortlistOS"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-light-300 text-light-1000 hover:bg-light-100 dark:border-dark-300 dark:text-dark-1000 dark:hover:bg-dark-100"
            aria-label={t`GitHub`}
          >
            <FaGithub />
          </Link>
          <div className="mt-5">
            <LanguageSelector />
          </div>
        </div>

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
      <div className="border-t border-light-300 py-5 text-center text-xs text-light-900 dark:border-dark-300 dark:text-dark-800">
        {t`(c) 2026 shortlistOS`}
      </div>
    </footer>
  );
};

export default Footer;
