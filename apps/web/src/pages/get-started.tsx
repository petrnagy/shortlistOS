import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import {
  HiOutlineArchiveBox,
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineArrowTrendingUp,
  HiOutlineAtSymbol,
  HiOutlineBars3BottomLeft,
  HiOutlineBellAlert,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineChatBubbleLeft,
  HiOutlineCheckCircle,
  HiOutlineChevronRight,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClock,
  HiOutlineCurrencyDollar,
  HiOutlineCursorArrowRays,
  HiOutlineDocumentText,
  HiOutlineEnvelope,
  HiOutlineGlobeAlt,
  HiOutlineListBullet,
  HiOutlinePaperClip,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineRectangleStack,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineTag,
  HiOutlineUserGroup,
  HiXMark,
} from "react-icons/hi2";

import { Alert } from "~/components/Alert";
import Button from "~/components/Button";
import { PageHead } from "~/components/PageHead";
import { FeatureCard, Section } from "~/views/home/components/LandingSection";
import Layout from "~/views/home/components/Layout";

const opportunityFields = [
  {
    icon: HiOutlineBuildingOffice2,
    title: t`Role and company`,
    description: t`Keep the employer, position, and contract type together.`,
  },
  {
    icon: HiOutlineGlobeAlt,
    title: t`Location and work model`,
    description: t`Record the job location and whether it is remote, hybrid, or on-site.`,
  },
  {
    icon: HiOutlineCurrencyDollar,
    title: t`Salary`,
    description: t`Save the advertised range, currency, and pay period for easy comparison.`,
  },
  {
    icon: HiOutlineUserGroup,
    title: t`Contacts`,
    description: t`Keep recruiter and hiring-manager details close to the opportunity.`,
  },
  {
    icon: HiOutlineDocumentText,
    title: t`Description, links, attachments`,
    description: t`Save the job description, useful links, notes, and related files.`,
  },
  {
    icon: HiOutlineCalendarDays,
    title: t`Status and dates`,
    description: t`See where the opportunity stands and keep interviews, deadlines, and follow-ups visible.`,
  },
  {
    icon: HiOutlineClipboardDocumentCheck,
    title: t`Checklists`,
    description: t`Turn preparation and follow-ups into clear steps you can tick off.`,
  },
  {
    icon: HiOutlineTag,
    title: t`Labels`,
    description: t`Mark priorities, benefits, concerns, and anything else you want to spot quickly.`,
  },
  {
    icon: HiOutlineClock,
    title: t`Activity history`,
    description: t`See changes, comments, and milestone moves in one chronological record.`,
  },
] as const;

const powerpackFeatures = [
  {
    icon: HiOutlineCurrencyDollar,
    title: t`Salary insights`,
    description: t`See an estimated salary range for the role, with local, EU, US, and global comparisons when data is available. It gives you a useful starting point for judging an advert and preparing to negotiate.`,
  },
  {
    icon: HiOutlineBuildingOffice2,
    title: t`Company rating snapshot`,
    description: t`When a confident company match is found, see its third-party employer rating and a short summary of available review data, such as work-life balance, culture, and recommendation score.`,
  },
  {
    icon: HiOutlineEnvelope,
    title: t`Magic Inbox`,
    description: t`Every shortlist gets its own private email address. Forward a recruiter email or job alert to it. shortlistOS reads it, creates or updates the right opportunity, and keeps the original email attached.`,
  },
  {
    icon: HiOutlineCursorArrowRays,
    title: t`Web Clipper for Chrome and Firefox`,
    description: t`Save a job while you are looking at it in Chrome or Firefox. Pick a shortlist and the extension sends the job to shortlistOS, where it becomes a new opportunity.`,
  },
  {
    icon: HiOutlineCalendarDays,
    title: t`Calendar feed`,
    description: t`Add a private shortlistOS calendar feed to Google Calendar, Apple Calendar, Outlook, or another calendar app. Your scheduled interview dates will appear in the calendar you already use.`,
  },
  {
    icon: HiOutlineBellAlert,
    title: t`Email reminders`,
    description: t`Choose how long an opportunity can sit still before shortlistOS emails you. You can set different reminders for saved jobs, applications, interviews, and negotiations.`,
  },
  {
    icon: HiOutlineListBullet,
    title: t`Weekly digest`,
    description: t`Start Monday with a simple email showing how many opportunities are in each stage and where your search may need attention.`,
  },
  {
    icon: HiOutlineArrowTrendingUp,
    title: t`Card aging`,
    description: t`Cards that have not changed for a while slowly gain a warmer colour. Old opportunities become easy to spot when you look at the board.`,
  },
  {
    icon: HiOutlineBellAlert,
    title: t`Saved opportunity reminders`,
    description: t`Ask shortlistOS to email you when a saved job has been sitting untouched for too long.`,
  },
  {
    icon: HiOutlineAtSymbol,
    title: t`Applied follow-up reminders`,
    description: t`Get an email when it may be time to follow up on an application that has gone quiet.`,
  },
  {
    icon: HiOutlineAtSymbol,
    title: t`Ghosted detection`,
    description: t`If an application stays quiet for the number of days you choose, shortlistOS can add a Ghosted label for you.`,
  },
  {
    icon: HiOutlineArchiveBox,
    title: t`Automatic archive`,
    description: t`Let shortlistOS archive old saved jobs automatically, so your board stays focused on jobs you may still pursue.`,
  },
  {
    icon: HiOutlineBriefcase,
    title: t`Interviewing nudges`,
    description: t`Get an email when an interview process has not moved for the number of days you choose.`,
  },
  {
    icon: HiOutlineCurrencyDollar,
    title: t`Negotiation nudges`,
    description: t`Get an email when a negotiation goes quiet, so an offer, counteroffer, or unanswered question is not forgotten.`,
  },
] as const;

const VisualFrame = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <div className="overflow-hidden rounded-2xl border border-light-300 bg-light-50 shadow-xl shadow-light-1000/5 dark:border-dark-300 dark:bg-dark-100 dark:shadow-black/20">
    <div className="flex items-center justify-between border-b border-light-300 bg-light-100 px-4 py-3 dark:border-dark-300 dark:bg-dark-200">
      <div className="flex gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-light-700 dark:text-dark-700">
        {label}
      </span>
    </div>
    {children}
  </div>
);

const BoardMockup = () => {
  const columns: {
    title: string;
    cards: {
      title: string;
      labels: { name: string; colour: string }[];
      description?: boolean;
      comments?: boolean;
      checklist?: string;
      attachment?: boolean;
      dueDate?: string;
    }[];
  }[] = [
    {
      title: t`Saved`,
      cards: [
        {
          title: t`Product Designer · Northstar`,
          labels: [{ name: t`High priority`, colour: "#ca8a04" }],
          description: true,
        },
        {
          title: t`Design Lead · Acme`,
          labels: [{ name: t`Remote`, colour: "#0d9488" }],
          dueDate: t`22 Aug`,
        },
      ],
    },
    {
      title: t`Applied`,
      cards: [
        {
          title: t`Senior Product Designer · Lumon`,
          labels: [{ name: t`Application confirmed`, colour: "#0d9488" }],
          description: true,
          comments: true,
          attachment: true,
        },
      ],
    },
    {
      title: t`Interviewing`,
      cards: [
        {
          title: t`Staff Designer · Orbit`,
          labels: [
            { name: t`Dream job`, colour: "#0d9488" },
            { name: t`High priority`, colour: "#ca8a04" },
          ],
          description: true,
          comments: true,
          checklist: "3/3",
          dueDate: t`Tomorrow`,
        },
      ],
    },
    {
      title: t`Offer`,
      cards: [
        {
          title: t`Principal Designer · Hooli`,
          labels: [
            { name: t`Above market salary`, colour: "#0d9488" },
            { name: t`Equity`, colour: "#0284c7" },
          ],
          attachment: true,
          checklist: "2/3",
          dueDate: t`25 Aug`,
        },
      ],
    },
  ];

  return (
    <VisualFrame label={t`Job search pipeline`}>
      <div className="overflow-x-auto bg-light-100 p-4 dark:bg-dark-50 sm:p-5">
        <div className="grid min-w-[840px] grid-cols-4 items-start gap-4">
          {columns.map((column) => (
            <div
              key={column.title}
              className="rounded-md border border-light-400 bg-light-300 p-2 dark:border-dark-300 dark:bg-dark-100"
            >
              <div className="mb-2 flex items-center justify-between px-3 pt-1">
                <span className="text-xs font-semibold text-light-1000 dark:text-dark-1000">
                  {column.title}
                </span>
                <HiOutlinePlus className="h-4 w-4 text-light-800 dark:text-dark-800" />
              </div>
              <div className="space-y-2">
                {column.cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-md border border-light-200 bg-light-50 px-3 py-2 text-xs text-light-1000 shadow-sm dark:border-dark-200 dark:bg-dark-200 dark:text-dark-1000"
                  >
                    <p className="min-h-8 leading-4">{card.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {card.labels.map((label) => (
                        <span
                          key={label.name}
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-medium text-light-800 ring-1 ring-inset ring-light-400 dark:text-dark-900 dark:ring-dark-500"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: label.colour }}
                          />
                          {label.name}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex min-h-4 items-center justify-between gap-2 text-light-700 dark:text-dark-700">
                      <div className="flex items-center gap-2">
                        {card.description ? (
                          <HiOutlineBars3BottomLeft className="h-3.5 w-3.5" />
                        ) : null}
                        {card.dueDate ? (
                          <span className="flex items-center gap-1 text-[9px] text-red-500 dark:text-red-400">
                            <HiOutlineClock className="h-3.5 w-3.5" />
                            {card.dueDate}
                          </span>
                        ) : null}
                        {card.comments ? (
                          <HiOutlineChatBubbleLeft className="h-3.5 w-3.5" />
                        ) : null}
                        {card.attachment ? (
                          <HiOutlinePaperClip className="h-3.5 w-3.5" />
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <HiOutlinePencil className="h-3.5 w-3.5" />
                        {card.checklist ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-light-300 px-1.5 py-0.5 text-[8px] dark:border-dark-400">
                            <span
                              className={`h-3 w-3 rounded-full border-2 ${
                                card.checklist === "3/3"
                                  ? "border-emerald-500"
                                  : "rotate-45 border-blue-400 border-t-light-200 dark:border-t-dark-400"
                              }`}
                            />
                            {card.checklist}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </VisualFrame>
  );
};

const CardMockup = () => {
  const detailRows = [
    [t`Status`, t`Interviewing`],
    [t`Interview`, t`Jun 19, 2026`],
    [t`Created`, t`Jun 12, 2026`],
  ] as const;
  const roleRows = [
    [t`Company`, "Northstar Group"],
    [t`Contract`, t`Full time`],
    [t`Location`, t`New York, NY`],
  ] as const;
  const labels = [
    [t`Application confirmed`, "bg-teal-500"],
    [t`High priority`, "bg-amber-500"],
    [t`Equity`, "bg-sky-600"],
  ] as const;
  const historyEvents = [
    {
      message: t`updated Salary maximum from $115,000 to $120,000`,
      timestamp: t`today`,
    },
    {
      message: t`updated Salary minimum from $100,000 to $105,000`,
      timestamp: t`today`,
    },
    {
      message: t`completed checklist item Review the company and role`,
      timestamp: t`yesterday`,
    },
    {
      message: t`added an attachment project-manager-resume.pdf`,
      timestamp: t`yesterday`,
    },
    {
      move: [t`In contact`, t`Interviewing`],
      timestamp: t`2 days ago`,
    },
    {
      message: t`added checklist Interview preparation`,
      timestamp: t`4 days ago`,
    },
    {
      message: t`updated Interview from empty to Jun 19, 2026`,
      timestamp: t`5 days ago`,
    },
    {
      move: [t`Applied`, t`In contact`],
      timestamp: t`6 days ago`,
    },
    {
      message: t`added label Application confirmed`,
      timestamp: t`8 days ago`,
    },
    {
      move: [t`Saved`, t`Applied`],
      timestamp: t`9 days ago`,
    },
    {
      message: t`updated Company from empty to Northstar Group`,
      timestamp: t`10 days ago`,
    },
    { message: t`updated the description`, timestamp: t`13 days ago` },
    { message: t`created the card`, timestamp: t`2 weeks ago` },
  ] as const;

  return (
    <VisualFrame label={t`Job opportunity detail`}>
      <div className="select-none bg-light-50 dark:bg-dark-50">
        <div className="flex h-11 items-center justify-between border-b border-light-300 px-4 dark:border-dark-300">
          <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold">
            <span className="text-light-900 dark:text-dark-900">
              {t`Full Stack Developer`}
            </span>
            <HiOutlineChevronRight className="h-3 w-3 text-light-600 dark:text-dark-600" />
            <span className="truncate text-light-700 dark:text-dark-700">
              {t`Project Manager`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-light-800 dark:text-dark-800">
            <span className="text-sm leading-none">•••</span>
            <HiXMark className="h-4 w-4" />
          </div>
        </div>

        <div className="h-[560px] overflow-y-auto overscroll-contain">
          <div className="grid md:grid-cols-[1fr_220px]">
            <div className="p-5 sm:p-6">
              <h3 className="text-base font-bold text-light-1000 dark:text-dark-1000">
                {t`Project Manager`}
              </h3>
              <div className="mt-4 space-y-2 text-[11px] leading-5 text-light-800 dark:text-dark-800">
                <p>
                  {t`Lead cross-functional projects from planning to delivery, keeping timelines, stakeholders, and risks aligned.`}
                </p>
                <p>
                  {t`Work with teams across the business to turn goals into clear plans and measurable outcomes.`}
                </p>
              </div>

              <div className="mt-6 border-t border-light-300 pt-5 dark:border-dark-300">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-light-1000 dark:text-dark-1000">
                    {t`Interview preparation`}
                  </p>
                  <span className="rounded-full border border-light-300 px-2 py-1 text-[9px] text-light-800 dark:border-dark-300 dark:text-dark-800">
                    2/3
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {[
                    t`Review the company and role`,
                    t`Prepare questions for the recruiter`,
                    t`Confirm the interview time`,
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-md py-1 text-[11px] text-light-800 dark:text-dark-800"
                    >
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] text-white ${
                          index < 2
                            ? "border-blue-600 bg-blue-600"
                            : "border-light-400 dark:border-dark-400"
                        }`}
                      >
                        {index < 2 ? "✓" : null}
                      </span>
                      <span
                        className={index < 2 ? "line-through opacity-60" : ""}
                      >
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-b border-light-300 pb-5 text-[11px] font-medium text-light-800 dark:border-dark-300 dark:text-dark-800">
                <span className="flex items-center gap-1.5">
                  <HiOutlinePlus className="h-3.5 w-3.5" />
                  {t`New checklist`}
                </span>
                <span className="flex items-center gap-1.5">
                  {t`Upload attachment`}
                  <HiOutlinePaperClip className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-light-1000 dark:text-dark-1000">
                    {t`History`}
                  </p>
                  <span className="text-[9px] text-light-700 dark:text-dark-700">
                    {t`Show only comments`}
                  </span>
                </div>
                <div className="mt-3 rounded-lg border border-light-300 bg-light-100 p-3 dark:border-dark-300 dark:bg-dark-100">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      S
                    </span>
                    <p className="text-[9px] text-light-800 dark:text-dark-800">
                      <strong className="text-light-1000 dark:text-dark-1000">
                        shortlistOS Robot
                      </strong>{" "}
                      · {t`23 days ago`}
                    </p>
                  </div>
                  <p className="mt-2 text-[9px] leading-4 text-light-800 dark:text-dark-800">
                    {t`Updated salary insights using market benchmarks for this role and location.`}
                  </p>
                </div>
                <div className="mt-2 space-y-2">
                  {historyEvents.map((event, index) => {
                    const move = "move" in event ? event.move : null;

                    return (
                      <div
                        key={`${event.timestamp}-${index}`}
                        className={
                          move
                            ? "flex items-start gap-2 rounded-sm border-l-[3px] border-green-500 bg-green-50/80 px-2 py-2 dark:border-green-400 dark:bg-green-950/30"
                            : "flex items-start gap-2 border-l-[3px] border-transparent px-2 py-1"
                        }
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-light-1000 text-[9px] font-bold text-white dark:bg-dark-1000 dark:text-dark-50">
                          P
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] leading-4 text-light-800 dark:text-dark-800">
                            <strong className="text-light-1000 dark:text-dark-1000">
                              Peter
                            </strong>{" "}
                            {move ? (
                              <>
                                {t`moved the card from`}{" "}
                                <strong className="text-light-1000 dark:text-dark-1000">
                                  {move[0]}
                                </strong>{" "}
                                {t`to`}{" "}
                                <strong className="text-light-1000 dark:text-dark-1000">
                                  {move[1]}
                                </strong>
                              </>
                            ) : "message" in event ? (
                              event.message
                            ) : null}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {move ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-green-500/50 bg-green-50 px-1.5 py-0.5 text-[8px] font-medium text-green-700 dark:border-green-400/40 dark:bg-green-950/30 dark:text-green-300">
                                <HiOutlineStar className="h-2.5 w-2.5" />
                                {t`Milestone`}
                              </span>
                            ) : null}
                            <span className="text-[8px] text-light-700 dark:text-dark-700">
                              {event.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="border-t border-light-300 bg-light-100 p-5 dark:border-dark-300 dark:bg-dark-100 md:border-l md:border-t-0">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-light-300 bg-light-100 dark:border-dark-300 dark:bg-dark-100">
                  <HiOutlineBriefcase className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold text-light-1000 dark:text-dark-1000">
                  {t`Opportunity details`}
                </p>
              </div>

              <div className="mt-5">
                <p className="text-[10px] font-semibold text-light-1000 dark:text-dark-1000">
                  {t`Details`}
                </p>
                <div className="mt-2 rounded-lg border border-light-300 p-2 dark:border-dark-300">
                  {detailRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[66px_1fr] items-center border-b border-light-200 px-1 py-2 text-[9px] last:border-0 dark:border-dark-200"
                    >
                      <span className="text-light-700 dark:text-dark-700">
                        {label}
                      </span>
                      <span className="font-medium text-light-1000 dark:text-dark-1000">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold text-light-1000 dark:text-dark-1000">
                  {t`Labels`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-light-300 p-2 dark:border-dark-300">
                  {labels.map(([label, colour]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[8px] text-light-800 ring-1 ring-inset ring-light-400 dark:text-dark-800 dark:ring-dark-400"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${colour}`} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold text-light-1000 dark:text-dark-1000">
                  {t`Role`}
                </p>
                <div className="mt-2 rounded-lg border border-light-300 p-2 dark:border-dark-300">
                  {roleRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[58px_1fr] items-center px-1 py-2 text-[9px]"
                    >
                      <span className="text-light-700 dark:text-dark-700">
                        {label}
                      </span>
                      <span className="rounded border border-light-300 px-1.5 py-1 text-light-1000 dark:border-dark-300 dark:text-dark-1000">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-light-300 p-3 dark:border-dark-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-light-1000 dark:text-dark-1000">
                    {t`Salary`}
                  </span>
                  <span className="text-[9px] text-light-700 dark:text-dark-700">
                    USD / year
                  </span>
                </div>
                <p className="mt-2 text-[10px] font-medium text-light-1000 dark:text-dark-1000">
                  $105,000–$120,000
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
};

const JourneyConnector = ({
  label,
  step,
}: {
  label: string;
  step: 0 | 1 | 2;
}) => (
  <div
    className={`absolute -bottom-16 left-1/2 z-10 flex h-14 w-28 -translate-x-1/2 flex-col items-center justify-center gap-2 text-center xl:-right-20 xl:bottom-auto xl:left-auto xl:top-1/2 xl:w-20 xl:-translate-y-1/2 xl:translate-x-0 ${
      step === 0
        ? "md:-right-28 md:bottom-auto md:left-auto md:top-1/2 md:w-28 md:-translate-y-1/2 md:translate-x-0"
        : step === 2
          ? "md:-left-28 md:bottom-auto md:top-1/2 md:w-28 md:-translate-y-1/2 md:translate-x-0 xl:-right-20 xl:left-auto xl:w-20"
          : ""
    }`}
  >
    <span className="px-2 text-[9px] font-medium leading-3 text-light-700 dark:text-dark-700">
      {label}
    </span>
    <HiOutlineArrowRight
      className={`h-5 w-5 rotate-90 text-light-600 dark:text-dark-600 xl:rotate-0 ${
        step === 0 ? "md:rotate-0" : step === 2 ? "md:rotate-180" : ""
      }`}
      aria-hidden="true"
    />
  </div>
);

const JourneyStepNumber = ({ number }: { number: 1 | 2 | 3 | 4 }) => (
  <span className="bg-brand-600 absolute -left-3 -top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-light-100 text-xs font-semibold text-white shadow-sm dark:border-dark-100">
    {number}
  </span>
);

const CaptureJourney = ({ kind }: { kind: "email" | "web" }) => {
  const isEmail = kind === "email";
  const roleTitle = isEmail ? t`Product Designer` : t`Frontend Developer`;
  const companyName = isEmail ? "Northstar" : "Brightside";

  return (
    <div className="rounded-2xl border border-light-300 bg-light-100 p-5 dark:border-dark-300 dark:bg-dark-100 sm:p-7">
      <div className="grid items-stretch gap-y-20 md:grid-cols-2 md:gap-x-28 xl:grid-cols-4 xl:gap-x-20 xl:gap-y-0">
        <div className="relative">
          <JourneyStepNumber number={1} />
          <div className="h-full overflow-hidden rounded-xl border border-light-300 bg-light-50 shadow-sm dark:border-dark-300 dark:bg-dark-200">
            {isEmail ? (
              <>
                <div className="flex items-center gap-2 border-b border-light-300 px-4 py-3 dark:border-dark-300">
                  <HiOutlineEnvelope className="text-brand-600 dark:text-brand-400 h-4 w-4" />
                  <span className="text-[10px] font-semibold text-light-1000 dark:text-dark-1000">
                    {t`Recruiter email`}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-[9px] text-light-700 dark:text-dark-700">
                    Maya Chen · {companyName}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-light-1000 dark:text-dark-1000">
                    {t`Interview invitation`}
                  </p>
                  <div className="mt-4 space-y-2" aria-hidden="true">
                    <span className="block h-1.5 w-full rounded bg-light-300 dark:bg-dark-400" />
                    <span className="block h-1.5 w-5/6 rounded bg-light-300 dark:bg-dark-400" />
                    <span className="block h-1.5 w-2/3 rounded bg-light-300 dark:bg-dark-400" />
                  </div>
                  <div className="mt-5 rounded-md bg-light-200 px-3 py-2 text-center text-[9px] font-semibold text-light-900 dark:bg-dark-300 dark:text-dark-900">
                    {t`Forward`}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-light-300 px-3 py-2.5 dark:border-dark-300">
                  <div className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="truncate rounded bg-light-200 px-2 py-1 text-[8px] text-light-700 dark:bg-dark-300 dark:text-dark-700">
                    careers.brightside.example
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-[9px] font-medium text-light-700 dark:text-dark-700">
                    {companyName}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-light-1000 dark:text-dark-1000">
                    {roleTitle}
                  </p>
                  <p className="mt-2 text-[9px] text-light-700 dark:text-dark-700">
                    {t`Remote · $105k–$120k`}
                  </p>
                  <div className="bg-brand-600 mt-5 rounded-md px-3 py-2 text-center text-[9px] font-semibold text-white">
                    {t`Save with shortlistOS`}
                  </div>
                </div>
              </>
            )}
          </div>
          <JourneyConnector
            step={0}
            label={isEmail ? t`Forward to shortlistOS` : t`Use the Web Clipper`}
          />
        </div>

        <div className="relative">
          <JourneyStepNumber number={2} />
          <div className="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/20 flex h-full flex-col items-center justify-center rounded-xl border p-4 text-center">
            <div className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400 flex h-11 w-11 items-center justify-center rounded-full">
              <HiOutlineSparkles className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-light-1000 dark:text-dark-1000">
              {isEmail ? t`Magic Inbox` : t`shortlistOS automation`}
            </p>
            <p className="mt-2 text-[10px] leading-4 text-light-800 dark:text-dark-800">
              {isEmail
                ? t`Receives the email, turns it into a card, adds salary insights and company rating data, and uses AI to assign labels and summarise the role and requirements.`
                : t`Processes the job page, turns it into a card, adds salary insights and company rating data, and uses AI to assign labels and summarise the role and requirements.`}
            </p>
          </div>
          <JourneyConnector step={1} label={t`Send to shortlist`} />
        </div>

        <div className="relative md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-start-1">
          <JourneyStepNumber number={3} />
          <div className="h-full rounded-xl border border-light-300 bg-light-300 p-2 dark:border-dark-300 dark:bg-dark-50">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-[10px] font-semibold text-light-1000 dark:text-dark-1000">
                {t`Job hunt 2026`}
              </p>
              <HiOutlinePlus className="h-3.5 w-3.5 text-light-700 dark:text-dark-700" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-light-200 p-1.5 dark:bg-dark-200">
                <p className="px-1 text-[8px] text-light-700 dark:text-dark-700">
                  {t`Saved`}
                </p>
                <div className="mt-1.5 rounded bg-light-50 p-2 shadow-sm dark:bg-dark-300">
                  <p className="text-[8px] leading-3 text-light-1000 dark:text-dark-1000">
                    {roleTitle} · {companyName}
                  </p>
                  <span className="mt-2 block h-1 w-8 rounded bg-emerald-400" />
                </div>
              </div>
              <div className="rounded-md bg-light-200 p-1.5 dark:bg-dark-200">
                <p className="px-1 text-[8px] text-light-700 dark:text-dark-700">
                  {t`Applied`}
                </p>
                <div className="mt-1.5 h-12 rounded border border-dashed border-light-400 dark:border-dark-400" />
              </div>
            </div>
          </div>
          <JourneyConnector
            step={2}
            label={isEmail ? t`Create or update card` : t`Create card`}
          />
        </div>

        <div className="relative md:col-start-1 md:row-start-2 xl:col-start-4 xl:row-start-1">
          <JourneyStepNumber number={4} />
          <div className="h-full overflow-hidden rounded-xl border border-light-300 bg-light-50 shadow-sm dark:border-dark-300 dark:bg-dark-200">
            <div className="border-b border-light-300 px-4 py-3 dark:border-dark-300">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-light-700 dark:text-dark-700">
                {t`Opportunity detail`}
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
                {roleTitle}
              </p>
              <p className="mt-1 text-[10px] text-light-700 dark:text-dark-700">
                {companyName}
              </p>
              <div className="mt-4 space-y-2 text-[9px] text-light-800 dark:text-dark-800">
                <div className="flex justify-between border-t border-light-300 pt-2 dark:border-dark-300">
                  <span>{t`Location`}</span>
                  <span>{t`Remote`}</span>
                </div>
                <div className="flex justify-between border-t border-light-300 pt-2 dark:border-dark-300">
                  <span>{t`Salary`}</span>
                  <span>$105k–$120k</span>
                </div>
                <div className="flex justify-between border-t border-light-300 pt-2 dark:border-dark-300">
                  <span>{t`Status`}</span>
                  <span>{isEmail ? t`Interviewing` : t`Saved`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GetStartedPage() {
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);

  return (
    <Layout>
      <PageHead title={t`Get started | shortlistOS`} />
      <main className="relative z-10 min-h-screen w-full px-4 pb-6 pt-24">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-light-700 transition hover:text-light-1000 dark:text-dark-700 dark:hover:text-dark-1000"
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          {t`Back to home`}
        </Link>

        <div className="w-full">
          <section className="mx-auto max-w-[760px] px-4 pb-20 pt-20 text-center lg:pt-28">
            <p className="text-brand-600 dark:text-brand-500 text-xs font-semibold uppercase tracking-[0.18em]">
              {t`Getting started with shortlistOS`}
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-light-1000 dark:text-dark-1000 sm:text-5xl lg:text-6xl">
              {t`Let's get your job search organised`}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-light-900 dark:text-dark-900">
              {t`This guide explains the basics, shows you how to organise each job opportunity, and introduces the optional tools that can save you time.`}
            </p>
          </section>

          <div
            aria-hidden="true"
            className="mx-auto mb-6 max-w-[980px] border-t border-light-300 dark:border-dark-300"
          />

          <Section
            id="foundations"
            eyebrow={t`01 · Foundations`}
            title={t`First, your workspace.`}
            description={t`shortlistOS has three simple levels. Your workspace contains shortlists, and each shortlist contains the job opportunities you are tracking.`}
          >
            <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <FeatureCard
                icon={HiOutlineRectangleStack}
                title={t`Workspace`}
                description={
                  <Trans>
                    Your workspace is the{" "}
                    <strong>base for everything you do</strong> in shortlistOS,
                    from managing your account to organizing your shortlists.
                    Every account has one workspace.
                  </Trans>
                }
                liftOnHover={false}
              />
              <div
                className="flex items-center justify-center"
                aria-hidden="true"
              >
                <HiOutlineChevronRight className="h-6 w-6 rotate-90 text-light-600 dark:text-dark-600 lg:rotate-0" />
              </div>
              <FeatureCard
                icon={HiOutlineListBullet}
                title={t`Shortlist`}
                description={
                  <Trans>
                    A shortlist is a <strong>board for one job search</strong>.
                    Its columns follow the natural stages of a job application.
                    From saving and applying through interviews, offers, and
                    finally, negotiation. Move an opportunity from left to right
                    as you progress.
                  </Trans>
                }
                liftOnHover={false}
              />
              <div
                className="flex items-center justify-center"
                aria-hidden="true"
              >
                <HiOutlineChevronRight className="h-6 w-6 rotate-90 text-light-600 dark:text-dark-600 lg:rotate-0" />
              </div>
              <FeatureCard
                icon={HiOutlineBriefcase}
                title={t`Job opportunity`}
                description={
                  <Trans>
                    <strong>Each card represents one available role</strong>.
                    Open the card to keep the job and company details, salary,
                    contacts, notes, dates, checklists, comments, attachments,
                    and activity history together.
                  </Trans>
                }
                liftOnHover={false}
              />
            </div>

            <p className="mt-7 text-center text-sm text-light-800 dark:text-dark-800">
              {t`Want to see how these levels fit together?`}{" "}
              <button
                type="button"
                onClick={() => setIsHierarchyOpen(true)}
                className="focus-visible:ring-brand-500 font-medium text-light-1000 underline decoration-light-500 underline-offset-4 hover:decoration-light-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:text-dark-1000 dark:decoration-dark-500 dark:hover:decoration-dark-1000 dark:focus-visible:ring-offset-dark-50"
              >
                {t`See an annotated example`}
              </button>
            </p>

            <Dialog
              open={isHierarchyOpen}
              onClose={setIsHierarchyOpen}
              className="relative z-50"
            >
              <DialogBackdrop className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
              <div className="fixed inset-0 overflow-y-auto p-4 sm:p-8">
                <div className="flex min-h-full items-center justify-center">
                  <DialogPanel className="relative w-full max-w-[1440px] rounded-xl bg-light-50 p-2 shadow-2xl dark:bg-dark-100 sm:p-3">
                    <DialogTitle className="sr-only">
                      {t`Workspace, shortlists, and opportunities`}
                    </DialogTitle>
                    <button
                      type="button"
                      onClick={() => setIsHierarchyOpen(false)}
                      className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      aria-label={t`Close image`}
                    >
                      <HiXMark className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <Image
                      src="/images/hierarchy.png"
                      alt={t`Annotated shortlistOS screen showing a workspace containing shortlists, with each shortlist containing job opportunities.`}
                      width={1435}
                      height={880}
                      className="h-auto max-h-[88vh] w-full rounded-lg object-contain"
                    />
                  </DialogPanel>
                </div>
              </div>
            </Dialog>
          </Section>

          <Section
            id="opportunities"
            eyebrow={t`02 · Opportunities`}
            title={t`Keep everything about a job in one place`}
            description={t`Each job opportunity is a card on your shortlist. Open the card to keep the useful details, your notes, files, tasks, and next step together.`}
          >
            <div className="grid items-center gap-10 lg:relative lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-[1200px] lg:-translate-x-1/2 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <h3 className="text-xl font-semibold text-light-1000 dark:text-dark-1000">{t`Add a job opportunity`}</h3>
                <ol className="mt-6 space-y-5">
                  {[
                    t`Open a shortlist and find the column where the job belongs.`,
                    t`Select Add opportunity and enter the job title.`,
                    t`Open the card whenever you want to add details, files, contacts, or a next step.`,
                  ].map((step, index) => (
                    <li key={step} className="flex gap-4">
                      <span className="bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        {index + 1}
                      </span>
                      <p className="pt-0.5 text-sm leading-6 text-light-900 dark:text-dark-900">
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
                <Alert
                  variant="info"
                  title={t`More ways to add opportunities`}
                  className="mt-6"
                >
                  <Trans>
                    Powerpack can also add jobs from the{" "}
                    <Link
                      href="#powerpack-web-clipper"
                      className="decoration-current/50 font-medium underline underline-offset-4 hover:decoration-current"
                    >
                      Web Clipper
                    </Link>{" "}
                    or{" "}
                    <Link
                      href="#powerpack-magic-inbox"
                      className="decoration-current/50 font-medium underline underline-offset-4 hover:decoration-current"
                    >
                      Magic Inbox
                    </Link>
                    .
                  </Trans>
                </Alert>
              </div>
              <CardMockup />
            </div>

            <div className="mt-16">
              <h3 className="text-center text-xl font-semibold text-light-1000 dark:text-dark-1000">{t`All the important data in one place`}</h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {opportunityFields.map(({ icon: Icon, title, description }) => (
                  <FeatureCard
                    key={title}
                    icon={Icon}
                    title={title}
                    description={description}
                    liftOnHover={false}
                  />
                ))}
              </div>
            </div>
          </Section>

          <Section
            id="pipeline"
            eyebrow={t`03 · Pipeline`}
            title={t`Move the card as things change`}
            description={t`Each column shows a stage of your job search. When you apply, start interviewing, receive an offer, or decide not to continue, move the card to the matching column.`}
          >
            <BoardMockup />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <FeatureCard
                icon={HiOutlineCheckCircle}
                title={t`At a glance`}
                description={t`See exactly where every opportunity in your job search stands.`}
                liftOnHover={false}
              />
              <FeatureCard
                icon={HiOutlineCursorArrowRays}
                title={t`Drag and drop`}
                description={t`Move cards between stages to keep your shortlist up to date.`}
                liftOnHover={false}
              />
              <FeatureCard
                icon={HiOutlineStar}
                title={t`Ready-made pipeline`}
                description={t`Every new shortlist comes with a complete job-search pipeline, ready to use.`}
                liftOnHover={false}
              />
            </div>
          </Section>

          <Alert variant="success" className="mx-auto my-16 max-w-3xl">
            <Trans>
              Right now, you are{" "}
              <Link
                href="/signup"
                className="decoration-current/50 font-medium underline underline-offset-4 hover:decoration-current"
              >
                ready to go
              </Link>
              . The second part of this guide covers the paid Powerpack
              features, which are not necessary for using shortlistOS.
            </Trans>
          </Alert>

          <Section
            id="powerpack"
            eyebrow={t`04 · Powerpack`}
            title={t`Let Powerpack take care of repetitive work`}
            description={t`Powerpack adds automation and AI to shortlistOS. Save jobs with Magic Inbox or the Web Clipper, get salary insights and company rating data, receive reminders, and automate routine housekeeping.`}
          >
            <div className="rounded-2xl bg-light-1000 p-7 text-white dark:bg-dark-100 sm:p-10">
              <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex items-center gap-2 text-violet-300">
                    <HiOutlineSparkles className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">{t`Powerpack`}</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold sm:text-3xl">{t`Spend less time copying information and remembering follow-ups.`}</h3>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t`You choose which features to use on each shortlist. You can also turn automation off for one opportunity whenever you want to manage it by hand.`}</p>
                </div>
                <Button
                  href="/settings/powerpack"
                  size="lg"
                  variant="secondary"
                  iconRight={<HiOutlineArrowRight className="h-4 w-4" />}
                >{t`Explore Powerpack`}</Button>
              </div>
            </div>

            <div id="powerpack-magic-inbox" className="mt-12 scroll-mt-24">
              <h3 className="text-center text-2xl font-semibold text-light-1000 dark:text-dark-1000">
                {powerpackFeatures[2].title}
              </h3>
              <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-6 text-light-900 dark:text-dark-900">
                {powerpackFeatures[2].description}
              </p>
              <div className="mt-6 lg:relative lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-[1200px] lg:-translate-x-1/2">
                <CaptureJourney kind="email" />
              </div>
            </div>

            <div id="powerpack-web-clipper" className="mt-16 scroll-mt-24">
              <h3 className="text-center text-2xl font-semibold text-light-1000 dark:text-dark-1000">
                {powerpackFeatures[3].title}
              </h3>
              <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-6 text-light-900 dark:text-dark-900">
                {powerpackFeatures[3].description}
              </p>
              <div className="mt-6 lg:relative lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-[1200px] lg:-translate-x-1/2">
                <CaptureJourney kind="web" />
              </div>
            </div>

            <div className="mt-12">
              <h3 className="text-center text-2xl font-semibold text-light-1000 dark:text-dark-1000">{t`More Powerpack features`}</h3>
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  ...powerpackFeatures.slice(0, 2),
                  ...powerpackFeatures.slice(4),
                ].map((feature) => (
                  <FeatureCard
                    key={feature.title}
                    {...feature}
                    liftOnHover={false}
                  />
                ))}
              </div>
            </div>
          </Section>

          <section className="pb-24 pt-8 text-center">
            <div className="rounded-2xl border border-light-300 bg-light-50 px-6 py-14 dark:border-dark-300 dark:bg-dark-100 sm:px-10">
              <h2 className="text-3xl font-bold tracking-tight text-light-1000 dark:text-dark-1000">{t`Your next opportunity deserves a clear next step`}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-light-900 dark:text-dark-900">{t`Create a shortlist, add the roles you care about, and let the board show you where to focus.`}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button
                  href="/boards"
                  size="lg"
                  iconRight={<HiOutlineArrowRight className="h-4 w-4" />}
                >{t`Open your workspace`}</Button>
                <Button
                  href="/settings/powerpack"
                  size="lg"
                  variant="secondary"
                >{t`View Powerpack`}</Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
