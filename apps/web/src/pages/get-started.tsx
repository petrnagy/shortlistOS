import type { ReactNode } from "react";
import Link from "next/link";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  HiOutlineArchiveBox,
  HiOutlineArrowLeft,
  HiOutlineArrowRight,
  HiOutlineArrowTrendingUp,
  HiOutlineAtSymbol,
  HiOutlineBellAlert,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheckCircle,
  HiOutlineChevronRight,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClock,
  HiOutlineCloudArrowUp,
  HiOutlineCurrencyDollar,
  HiOutlineCursorArrowRays,
  HiOutlineDocumentText,
  HiOutlineEnvelope,
  HiOutlineGlobeAlt,
  HiOutlineLink,
  HiOutlineListBullet,
  HiOutlinePaperClip,
  HiOutlineRectangleStack,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineTag,
  HiOutlineUserGroup,
  HiOutlineUserPlus,
} from "react-icons/hi2";

import Button from "~/components/Button";
import { PageHead } from "~/components/PageHead";
import { FeatureCard, Section } from "~/views/home/components/LandingSection";
import Layout from "~/views/home/components/Layout";

const opportunityFields = [
  { icon: HiOutlineBuildingOffice2, label: t`Company and role` },
  { icon: HiOutlineGlobeAlt, label: t`Location and work model` },
  { icon: HiOutlineCurrencyDollar, label: t`Salary range and currency` },
  { icon: HiOutlineCalendarDays, label: t`Due dates and interviews` },
  { icon: HiOutlineUserGroup, label: t`Recruiters and contacts` },
  { icon: HiOutlineLink, label: t`Job posting and company links` },
  { icon: HiOutlineTag, label: t`Labels and members` },
  { icon: HiOutlineDocumentText, label: t`Description and notes` },
] as const;

const cardFeatures = [
  {
    icon: HiOutlineClipboardDocumentCheck,
    title: t`Checklists`,
    description: t`Turn a big task into a short list of things you can tick off one by one.`,
  },
  {
    icon: HiOutlineChatBubbleLeftRight,
    title: t`Comments`,
    description: t`Write down updates and decisions where you will find them again.`,
  },
  {
    icon: HiOutlinePaperClip,
    title: t`Attachments`,
    description: t`Keep the job advert, CV, cover letter, offer, and other files together.`,
  },
  {
    icon: HiOutlineClock,
    title: t`Activity history`,
    description: t`See what changed and when, including dates, comments, and moves between stages.`,
  },
  {
    icon: HiOutlineUserPlus,
    title: t`Members`,
    description: t`Share an opportunity with someone you trust or show who is looking after it.`,
  },
  {
    icon: HiOutlineSparkles,
    title: t`Per-card automation`,
    description: t`Let Powerpack update a card, or keep one opportunity completely manual.`,
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
    title: t`Company ratings and employer insights`,
    description: t`See company ratings and employer information next to the job. This can help you decide whether the company deserves more of your time.`,
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
    description: t`Add a private shortlistOS calendar feed to Google Calendar, Apple Calendar, Outlook, or another calendar app. Your opportunity dates will appear in the calendar you already use.`,
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
  const columns = [
    {
      title: t`Saved`,
      cards: [t`Product Designer · Northstar`, t`Design Lead · Acme`],
    },
    {
      title: t`Applied`,
      cards: [t`Senior Product Designer · Lumon`],
    },
    {
      title: t`Interviewing`,
      cards: [t`Staff Designer · Orbit`],
    },
    {
      title: t`Offer`,
      cards: [t`Principal Designer · Hooli`],
    },
  ];

  return (
    <VisualFrame label={t`Mockup · replace with board screenshot`}>
      <div className="overflow-x-auto p-4 sm:p-6">
        <div className="grid min-w-[720px] grid-cols-4 gap-3">
          {columns.map((column, columnIndex) => (
            <div
              key={column.title}
              className="rounded-lg bg-light-100 p-3 dark:bg-dark-200"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-light-1000 dark:text-dark-1000">
                  {column.title}
                </span>
                <span className="text-[10px] text-light-700 dark:text-dark-700">
                  {column.cards.length}
                </span>
              </div>
              <div className="space-y-2">
                {column.cards.map((card, cardIndex) => (
                  <div
                    key={card}
                    className={`rounded-md border bg-light-50 p-3 shadow-sm dark:bg-dark-100 ${
                      columnIndex === 2 && cardIndex === 0
                        ? "border-brand-400 ring-brand-200 dark:ring-brand-800 ring-2"
                        : "border-light-300 dark:border-dark-300"
                    }`}
                  >
                    <div className="mb-2 flex gap-1">
                      <span className="bg-brand-500 h-1.5 w-8 rounded-full" />
                      {columnIndex > 0 ? (
                        <span className="h-1.5 w-5 rounded-full bg-emerald-400" />
                      ) : null}
                    </div>
                    <p className="text-[11px] font-medium leading-4 text-light-1000 dark:text-dark-1000">
                      {card}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[9px] text-light-700 dark:text-dark-700">
                      <span>
                        {columnIndex === 2
                          ? t`Interview tomorrow`
                          : t`Updated recently`}
                      </span>
                      <HiOutlinePaperClip className="h-3 w-3" />
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

const CardMockup = () => (
  <VisualFrame label={t`Mockup · replace with opportunity screenshot`}>
    <div className="grid gap-0 md:grid-cols-[1fr_240px]">
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            {t`Interviewing`}
          </span>
          <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {t`Remote`}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold text-light-1000 dark:text-dark-1000">
          {t`Senior Product Designer`}
        </h3>
        <p className="mt-1 text-sm text-light-800 dark:text-dark-800">
          Northstar Labs
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          {[
            [t`Salary`, "€82k–€98k"],
            [t`Location`, t`Remote · EU`],
            [t`Next step`, t`Interview · Tue`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg bg-light-100 p-3 dark:bg-dark-200"
            >
              <p className="text-[10px] uppercase tracking-wide text-light-700 dark:text-dark-700">
                {label}
              </p>
              <p className="mt-1 font-medium text-light-1000 dark:text-dark-1000">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-light-300 pt-5 dark:border-dark-300">
          <p className="text-xs font-semibold text-light-1000 dark:text-dark-1000">{t`Interview preparation`}</p>
          <div className="mt-3 space-y-2">
            {[
              t`Review product and competitors`,
              t`Prepare portfolio walkthrough`,
              t`Send thank-you note`,
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-2 text-xs text-light-800 dark:text-dark-800"
              >
                <span
                  className={`h-3.5 w-3.5 rounded border ${index < 2 ? "border-brand-500 bg-brand-500" : "border-light-400 dark:border-dark-400"}`}
                />
                <span className={index < 2 ? "line-through opacity-60" : ""}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <aside className="border-t border-light-300 bg-light-100 p-5 dark:border-dark-300 dark:bg-dark-200 md:border-l md:border-t-0">
        <p className="text-xs font-semibold text-light-1000 dark:text-dark-1000">{t`Activity`}</p>
        <div className="mt-4 space-y-4">
          {[
            t`Moved to Interviewing`,
            t`Attached tailored-cv.pdf`,
            t`Added a comment`,
          ].map((item, index) => (
            <div key={item} className="flex gap-3">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === 0 ? "bg-brand-500" : "bg-light-400 dark:bg-dark-500"}`}
              />
              <div>
                <p className="text-[11px] leading-4 text-light-900 dark:text-dark-900">
                  {item}
                </p>
                <p className="mt-1 text-[9px] text-light-700 dark:text-dark-700">
                  {index === 0 ? t`Today` : t`Yesterday`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  </VisualFrame>
);

const CaptureMockup = () => (
  <div className="grid gap-4 md:grid-cols-2">
    <VisualFrame label={t`Magic Inbox mockup`}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded-lg p-3">
            <HiOutlineEnvelope className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-light-700 dark:text-dark-700">{t`Forward to`}</p>
            <p className="mt-1 truncate text-sm font-semibold text-light-1000 dark:text-dark-1000">
              product-search.you@inbox.shortlistos.co
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-light-300 p-4 dark:border-dark-300">
          <p className="text-xs font-semibold text-light-1000 dark:text-dark-1000">{t`Re: Interview invitation`}</p>
          <p className="mt-2 text-[11px] leading-5 text-light-800 dark:text-dark-800">
            {t`shortlistOS reads the forwarded message, finds the matching opportunity, and records the update.`}
          </p>
        </div>
      </div>
    </VisualFrame>
    <VisualFrame label={t`Web Clipper mockup`}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded-lg p-3">
            <HiOutlineCursorArrowRays className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
              shortlistOS
            </p>
            <p className="text-[11px] text-light-700 dark:text-dark-700">{t`Save this opportunity`}</p>
          </div>
        </div>
        <label className="mt-6 block text-[10px] font-semibold uppercase tracking-wide text-light-700 dark:text-dark-700">
          {t`Shortlist`}
        </label>
        <div className="mt-2 flex items-center justify-between rounded-lg border border-light-300 px-3 py-2.5 text-xs text-light-1000 dark:border-dark-300 dark:text-dark-1000">
          <span>{t`Product design search`}</span>
          <HiOutlineChevronRight className="h-4 w-4 rotate-90" />
        </div>
        <div className="bg-brand-600 mt-4 rounded-lg px-4 py-2.5 text-center text-xs font-semibold text-white">
          {t`Save opportunity`}
        </div>
      </div>
    </VisualFrame>
  </div>
);

export default function GetStartedPage() {
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
                    Its columns follow the natural stages, from saving and
                    applying through interviews, offers, and negotiation. Move
                    an opportunity from left to right as you progress.
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
                    <strong>Each card represents one role</strong>. Open the
                    card to keep the job and company details, salary, contacts,
                    notes, dates, checklists, comments, attachments, and
                    activity history together.
                  </Trans>
                }
                liftOnHover={false}
              />
            </div>
          </Section>

          <Section
            id="opportunities"
            eyebrow={t`02 · Opportunities`}
            title={t`Keep everything about a job in one place`}
            description={t`Each job opportunity is a card on your shortlist. Open the card to keep the useful details, your notes, files, tasks, and next step together.`}
          >
            <div className="grid items-center gap-10 lg:grid-cols-[0.72fr_1.28fr]">
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
                <p className="mt-6 rounded-lg border border-light-300 bg-light-50 p-4 text-sm leading-6 text-light-800 dark:border-dark-300 dark:bg-dark-100 dark:text-dark-800">
                  {t`Powerpack can also add jobs from the Web Clipper or Magic Inbox. When it does, the card clearly shows that the shortlistOS robot created it.`}
                </p>
              </div>
              <CardMockup />
            </div>

            <div className="mt-16">
              <h3 className="text-xl font-semibold text-light-1000 dark:text-dark-1000">{t`Add as much or as little detail as you need`}</h3>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {opportunityFields.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-lg border border-light-300 bg-light-50 p-4 dark:border-dark-300 dark:bg-dark-100"
                  >
                    <Icon className="text-brand-600 dark:text-brand-400 h-5 w-5 shrink-0" />
                    <span className="text-sm font-medium text-light-900 dark:text-dark-900">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cardFeatures.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>

            <div className="mt-16 grid gap-8 rounded-2xl border border-light-300 bg-light-50 p-6 dark:border-dark-300 dark:bg-dark-100 sm:p-8 lg:grid-cols-2">
              <div>
                <HiOutlineChatBubbleLeftRight className="text-brand-600 dark:text-brand-400 h-7 w-7" />
                <h3 className="mt-5 text-xl font-semibold text-light-1000 dark:text-dark-1000">{t`Use comments as a simple running notebook`}</h3>
                <p className="mt-3 text-sm leading-6 text-light-900 dark:text-dark-900">{t`Write down what happened after a recruiter call, save your interview thoughts, mention another workspace member, or leave a note for your future self. Every comment stays with the opportunity.`}</p>
              </div>
              <div>
                <HiOutlineCloudArrowUp className="text-brand-600 dark:text-brand-400 h-7 w-7" />
                <h3 className="mt-5 text-xl font-semibold text-light-1000 dark:text-dark-1000">{t`Keep important files with the job`}</h3>
                <p className="mt-3 text-sm leading-6 text-light-900 dark:text-dark-900">{t`Attach your CV, cover letter, portfolio, job advert, interview task, or offer. You will not have to search through downloads and old email threads later.`}</p>
              </div>
            </div>
          </Section>

          <Section
            id="pipeline"
            eyebrow={t`03 · Pipeline`}
            title={t`Move a job as things change`}
            description={t`Each column shows a stage of your job search. When you apply, start interviewing, receive an offer, or decide not to continue, move the card to the matching column.`}
          >
            <BoardMockup />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <FeatureCard
                icon={HiOutlineCursorArrowRays}
                title={t`Drag and drop`}
                description={t`Pick up a card and drop it into another column. shortlistOS records the move for you.`}
              />
              <FeatureCard
                icon={HiOutlineCheckCircle}
                title={t`Keep the state truthful`}
                description={t`Let the column show where the job stands now. Use a date or checklist for what you need to do next.`}
              />
              <FeatureCard
                icon={HiOutlineStar}
                title={t`Make the pipeline yours`}
                description={t`You can rename, add, remove, and reorder columns if the default stages do not suit your search.`}
              />
            </div>
          </Section>

          <Section
            id="powerpack"
            eyebrow={t`04 · Powerpack`}
            title={t`Let Powerpack take care of repetitive work`}
            description={t`Powerpack is an optional paid add-on. You do not need it to organise your job search. It adds easier ways to save jobs, useful salary and company information, reminders, and automatic housekeeping.`}
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

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {powerpackFeatures.slice(0, 2).map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>

            <div className="mt-12">
              <h3 className="text-2xl font-semibold text-light-1000 dark:text-dark-1000">{t`Save jobs without copying and pasting`}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-light-900 dark:text-dark-900">{t`Magic Inbox works with emails. The Web Clipper works with job pages. Both can turn what you send into an organised opportunity.`}</p>
              <div className="mt-6">
                <CaptureMockup />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {powerpackFeatures.slice(2, 4).map((feature) => (
                  <FeatureCard key={feature.title} {...feature} />
                ))}
              </div>
            </div>

            <div className="mt-12">
              <h3 className="text-2xl font-semibold text-light-1000 dark:text-dark-1000">{t`Remember the next step without keeping it all in your head`}</h3>
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {powerpackFeatures.slice(4).map((feature) => (
                  <FeatureCard key={feature.title} {...feature} />
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
