import Link from "next/link";
import { t } from "@lingui/core/macro";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FaDesktop, FaGithub, FaMoon, FaSun } from "react-icons/fa";
import { twMerge } from "tailwind-merge";

const navigation = [
  { label: t`Product`, href: "/#product" },
  { label: t`Powerpack`, href: "/#powerpack" },
  { label: t`Pricing`, href: "/#pricing" },
  { label: t`Privacy`, href: "/#privacy" },
  {
    label: t`GitHub`,
    href: "https://github.com/petrnagy/shortlistOS",
    external: true,
  },
];

const Header = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const appHref = isLoggedIn ? "/boards" : "/login";
  const appLabel = isLoggedIn ? t`Go to app` : t`Log in`;

  useEffect(() => {
    document.documentElement.classList.toggle("overflow-hidden", isMenuOpen);
    document.body.classList.toggle("overflow-hidden", isMenuOpen);
    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    };
  }, [isMenuOpen]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-light-300 bg-light-50/85 backdrop-blur-xl dark:border-dark-300 dark:bg-dark-50/85">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4">
          <Link
            href="/"
            className="text-xl font-bold tracking-normal text-light-1000 dark:text-dark-1000"
          >
            shortlist<span className="font-medium">OS</span>
          </Link>

          <nav className="hidden items-center gap-9 lg:flex">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="text-sm font-semibold text-light-950 transition hover:text-light-1000 dark:text-dark-900 dark:hover:text-dark-1000"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center justify-end gap-3 lg:flex">
            <ThemeModeToggle theme={theme} setTheme={setTheme} />
            <Link
              href={appHref}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-light-1000 px-3 py-2 text-sm font-semibold text-light-50 shadow-sm focus-visible:outline-none dark:bg-dark-1000 dark:text-dark-50"
            >
              <span className="relative flex items-center justify-center">
                <span className="flex items-center">{appLabel}</span>
              </span>
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen((current) => !current)}
            className="relative z-50 h-10 w-10 rounded-lg border border-light-300 bg-light-50 dark:border-dark-300 dark:bg-dark-100 lg:hidden"
            aria-label={t`Toggle menu`}
          >
            <span
              className={twMerge(
                "absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 -translate-y-1.5 rounded-full bg-light-1000 transition dark:bg-dark-1000",
                isMenuOpen && "translate-y-0 rotate-45",
              )}
            />
            <span
              className={twMerge(
                "absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 translate-y-1.5 rounded-full bg-light-1000 transition dark:bg-dark-1000",
                isMenuOpen && "translate-y-0 -rotate-45",
              )}
            />
          </button>
        </div>
      </header>

      <div
        className={twMerge(
          "fixed inset-0 z-40 bg-light-50/95 px-5 pt-24 backdrop-blur-xl transition dark:bg-dark-50/95 lg:hidden",
          isMenuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <div className="mx-auto max-w-sm space-y-3">
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between rounded-xl border border-light-300 bg-light-100 px-4 py-4 text-base font-bold text-light-1000 dark:border-dark-300 dark:bg-dark-100 dark:text-dark-1000"
            >
              {item.label}
              {item.external && <FaGithub className="h-4 w-4" />}
            </Link>
          ))}
          <ThemeModeToggle
            theme={theme}
            setTheme={setTheme}
            className="w-full justify-center rounded-xl border border-light-300 bg-light-100 p-2 dark:border-dark-300 dark:bg-dark-100"
          />
          <Link
            href={appHref}
            onClick={() => setIsMenuOpen(false)}
            className="flex rounded-xl bg-light-1000 px-4 py-4 text-base font-bold text-light-50 dark:bg-dark-1000 dark:text-dark-50"
          >
            {appLabel}
          </Link>
        </div>
      </div>
    </>
  );
};

function ThemeModeToggle({
  theme,
  setTheme,
  className,
}: {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  className?: string;
}) {
  const currentTheme = theme ?? "system";
  const modes = [
    { value: "light", label: t`Light`, icon: FaSun },
    { value: "dark", label: t`Dark`, icon: FaMoon },
    { value: "system", label: t`Auto`, icon: FaDesktop },
  ];

  return (
    <div
      className={twMerge(
        "inline-flex items-center gap-1 rounded-md border border-light-300 bg-light-50 p-1 dark:border-dark-300 dark:bg-dark-100",
        className,
      )}
    >
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentTheme === mode.value;

        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => setTheme(mode.value)}
            className={twMerge(
              "inline-flex h-8 w-8 items-center justify-center rounded text-light-900 transition hover:bg-light-200 hover:text-light-1000 dark:text-dark-900 dark:hover:bg-dark-200 dark:hover:text-dark-1000",
              isActive &&
                "bg-light-1000 text-light-50 hover:bg-light-1000 hover:text-light-50 dark:bg-dark-1000 dark:text-dark-50 dark:hover:bg-dark-1000 dark:hover:text-dark-50",
            )}
            aria-label={mode.label}
            title={mode.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export default Header;
