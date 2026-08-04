import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@headlessui/react";
import { t } from "@lingui/core/macro";
import { env } from "next-runtime-env";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { HiBolt } from "react-icons/hi2";
import {
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
} from "react-icons/tb";
import { twMerge } from "tailwind-merge";

import type { Subscription } from "@kan/shared/utils";
import { hasActiveSubscription } from "@kan/shared/utils";

import type { KeyboardShortcut } from "~/providers/keyboard-shortcuts";
import activityLogsIconDark from "~/assets/activity-logs-dark.json";
import activityLogsIconLight from "~/assets/activity-logs-light.json";
import boardsIconDark from "~/assets/boards-dark.json";
import boardsIconLight from "~/assets/boards-light.json";
// import membersIconDark from "~/assets/members-dark.json";
// import membersIconLight from "~/assets/members-light.json";
import settingsIconDark from "~/assets/settings-dark.json";
import settingsIconLight from "~/assets/settings-light.json";
// import templatesIconDark from "~/assets/templates-dark.json";
// import templatesIconLight from "~/assets/templates-light.json";
import ButtonComponent from "~/components/Button";
import IconBolt from "~/components/IconBolt";
import ReactiveButton from "~/components/ReactiveButton";
import UserMenu from "~/components/UserMenu";
import WorkspaceMenu from "~/components/WorkspaceMenu";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import { hasActivePowerpack } from "~/utils/powerpack";

interface SideNavigationProps {
  user: UserType;
  isLoading: boolean;
  onCloseSideNav?: () => void;
}

interface UserType {
  displayName?: string | null | undefined;
  email?: string | null | undefined;
  image?: string | null | undefined;
  shortlistPowerpackActivatedAt?: Date | null;
  shortlistPowerpackExpiresAt?: Date | null;
}

export default function SideNavigation({
  user,
  isLoading,
  onCloseSideNav,
}: SideNavigationProps) {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInitialised, setIsInitialised] = useState(false);

  const { data: workspaceData, isLoading: workspaceDataLoading } =
    api.workspace.byId.useQuery(
      { workspacePublicId: workspace.publicId },
      { enabled: !!workspace.publicId && workspace.publicId.length >= 12 },
    );

  const { data: shortlists } = api.board.all.useQuery(
    {
      workspacePublicId: workspace.publicId,
      type: "regular",
      archived: false,
    },
    { enabled: !!workspace.publicId },
  );

  const subscriptions = workspaceData?.subscriptions as
    | Subscription[]
    | undefined;

  useEffect(() => {
    const savedState = localStorage.getItem("kan_sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(Boolean(JSON.parse(savedState)));
    }
    setIsInitialised(true);
  }, []);

  useEffect(() => {
    if (isInitialised) {
      localStorage.setItem(
        "kan_sidebar-collapsed",
        JSON.stringify(isCollapsed),
      );
    }
  }, [isCollapsed, isInitialised]);

  const { pathname } = router;
  const firstPathSegment =
    pathname.split("/").find((segment) => segment.length > 0) ?? "";
  const activeRootPath = firstPathSegment ? `/${firstPathSegment}` : pathname;

  const { resolvedTheme } = useTheme();

  const isCloudEnv = env("NEXT_PUBLIC_KAN_ENV") === "cloud";
  const userHasActivePowerpack = hasActivePowerpack(user);

  const isDarkMode = resolvedTheme === "dark";

  const navigation: {
    name: string;
    href: string;
    icon: object;
    keyboardShortcut: KeyboardShortcut;
  }[] = [
    {
      name: t`Shortlists`,
      href: "/boards",
      icon: isDarkMode ? boardsIconDark : boardsIconLight,
      keyboardShortcut: {
        type: "SEQUENCE",
        strokes: [{ key: "G" }, { key: "S" }],
        action: () => {
          void router.push("/boards");
        },
        group: "NAVIGATION",
        description: t`Go to shortlists`,
      },
    },
    {
      name: t`Activity log`,
      href: "/activity-log",
      icon: isDarkMode ? activityLogsIconDark : activityLogsIconLight,
      keyboardShortcut: {
        type: "SEQUENCE",
        strokes: [{ key: "G" }, { key: "A" }],
        action: () => {
          void router.push("/activity-log");
        },
        group: "NAVIGATION",
        description: t`Go to activity log`,
      },
    },
    // {
    //   name: t`Templates`,
    //   href: "/templates",
    //   icon: isDarkMode ? templatesIconDark : templatesIconLight,
    //   keyboardShortcut: {
    //     type: "SEQUENCE",
    //     strokes: [{ key: "G" }, { key: "T" }],
    //     action: () => router.push("/templates"),
    //     group: "NAVIGATION",
    //     description: t`Go to templates`,
    //   },
    // },
    // {
    //   name: t`Members`,
    //   href: "/members",
    //   icon: isDarkMode ? membersIconDark : membersIconLight,
    //   keyboardShortcut: {
    //     type: "SEQUENCE",
    //     strokes: [{ key: "G" }, { key: "M" }],
    //     action: () => router.push("/members"),
    //     group: "NAVIGATION",
    //     description: t`Go to members`,
    //   },
    // },
    {
      name: t`Settings`,
      href: "/settings",
      icon: isDarkMode ? settingsIconDark : settingsIconLight,
      keyboardShortcut: {
        type: "SEQUENCE",
        strokes: [{ key: "G" }, { key: "," }],
        action: () => {
          void router.push("/settings");
        },
        group: "NAVIGATION",
        description: t`Go to settings`,
      },
    },
  ];

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      <nav
        className={twMerge(
          "flex h-full w-64 flex-col justify-between border-r border-light-300 bg-light-100 p-3 dark:border-dark-300 dark:bg-dark-100 md:border-r-0 md:py-0 md:pl-0",
          isCollapsed && "md:w-auto",
        )}
      >
        <div>
          <div className="hidden h-[45px] items-center justify-between pb-3 md:flex">
            {!isCollapsed && (
              <Link
                href="/"
                className="block"
              >
                <h1 className="pl-2 text-[16px] font-bold tracking-tight text-neutral-900 dark:text-dark-1000">
                  {t`shortlistOS`}
                </h1>
              </Link>
            )}
            <Button
              onClick={toggleCollapse}
              className={twMerge(
                "flex h-8 items-center justify-center rounded-md hover:bg-light-200 dark:hover:bg-dark-200",
                isCollapsed ? "w-full" : "w-8",
              )}
            >
              {isCollapsed ? (
                <TbLayoutSidebarLeftExpand
                  size={18}
                  className="text-light-900 dark:text-dark-900"
                />
              ) : (
                <TbLayoutSidebarLeftCollapse
                  size={18}
                  className="text-light-900 dark:text-dark-900"
                />
              )}
            </Button>
          </div>
          <div className="mx-1 mb-4 hidden w-auto border-b border-light-300 dark:border-dark-400 md:block" />
          <WorkspaceMenu isCollapsed={isCollapsed} />
          <ul role="list" className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <ReactiveButton
                  href={item.href}
                  current={activeRootPath === item.href}
                  name={item.name}
                  json={item.icon}
                  isCollapsed={isCollapsed}
                  onCloseSideNav={onCloseSideNav}
                  keyboardShortcut={item.keyboardShortcut}
                />
                {item.href === "/boards" &&
                !isCollapsed &&
                shortlists?.length ? (
                  <ul
                    role="list"
                    className="ml-7 mt-1 hidden min-w-0 max-w-full space-y-0.5 pl-2 md:block"
                  >
                    {shortlists.map((shortlist) => {
                      const href = `/boards/${shortlist.publicId}`;
                      const isCurrent = router.asPath.startsWith(href);

                      return (
                        <li key={shortlist.publicId} className="min-w-0">
                          <Link
                            href={href}
                            aria-current={isCurrent ? "page" : undefined}
                            className={twMerge(
                              "block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-2 py-1.5 text-sm hover:bg-light-200 hover:text-light-1000 dark:hover:bg-dark-200 dark:hover:text-dark-1000",
                              isCurrent
                                ? "bg-light-200 font-medium text-light-1000 dark:bg-dark-200 dark:text-dark-1000"
                                : "text-neutral-600 dark:text-dark-900",
                            )}
                          >
                            {shortlist.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className={twMerge("space-y-2")}>
          <UserMenu
            displayName={user.displayName ?? undefined}
            email={user.email ?? "Email not provided"}
            imageUrl={user.image ?? undefined}
            isLoading={isLoading}
            isCollapsed={isCollapsed}
            onCloseSideNav={onCloseSideNav}
          />

          {!isLoading && !userHasActivePowerpack && (
            <div
              className={twMerge(
                "w-full",
                isCollapsed && "flex justify-center",
              )}
            >
              {isCollapsed ? (
                <ButtonComponent
                  iconLeft={<IconBolt />}
                  variant="secondary"
                  href="/settings/powerpack"
                  aria-label={t`Get the Powerpack`}
                  title={t`Get the Powerpack`}
                  iconOnly
                />
              ) : (
                <ButtonComponent
                  iconLeft={<IconBolt />}
                  fullWidth
                  variant="secondary"
                  href="/settings/powerpack"
                >
                  {t`Get the Powerpack`}
                </ButtonComponent>
              )}
            </div>
          )}

          {isCloudEnv &&
            !workspaceDataLoading &&
            !hasActiveSubscription(subscriptions, "pro") &&
            !hasActiveSubscription(subscriptions, "team") && (
              <div
                className={twMerge(
                  "w-full",
                  isCollapsed && "flex justify-center",
                )}
              >
                {isCollapsed ? (
                  <ButtonComponent
                    iconLeft={<HiBolt />}
                    variant="secondary"
                    href={`/upgrade/select-plan?plan=pro&workspacePublicId=${workspace.publicId}&returnUrl=${encodeURIComponent("/settings/billing")}`}
                    aria-label={t`Start free trial`}
                    title={t`Start free trial`}
                    iconOnly
                  />
                ) : (
                  <ButtonComponent
                    iconLeft={<HiBolt />}
                    fullWidth
                    variant="secondary"
                    href={`/upgrade/select-plan?plan=pro&workspacePublicId=${workspace.publicId}&returnUrl=${encodeURIComponent("/settings/billing")}`}
                  >
                    {t`Start free trial`}
                  </ButtonComponent>
                )}
              </div>
            )}
        </div>
      </nav>
    </>
  );
}
