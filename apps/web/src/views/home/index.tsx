import Link from "next/link";
import { t } from "@lingui/core/macro";
import {
  FaArrowDown,
  FaBell,
  FaChartLine,
  FaCheck,
  FaCode,
  FaGithub,
  FaGlobeEurope,
  FaInbox,
  FaLink,
  FaLock,
  FaRegClock,
  FaShieldAlt,
} from "react-icons/fa";

import { PageHead } from "~/components/PageHead";
import Layout from "./components/Layout";

const primaryCta = t`Get Powerpack - $29`;
const secondaryCta = t`Start free`;

export default function HomeView() {
  const workspaceFeatures = [
    {
      title: t`A pipeline that matches your process`,
      description: t`Create your own stages and move opportunities through them as the search progresses.`,
      accent:
        "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      icon: FaChartLine,
    },
    {
      title: t`One complete record per opportunity`,
      description: t`Keep the job description, company, salary, contacts, notes, attachments and interview dates together.`,
      accent:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      icon: FaInbox,
    },
    {
      title: t`A timeline you can trust`,
      description: t`See every update, note and status change in chronological order.`,
      accent:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      icon: FaRegClock,
    },
    {
      title: t`Your data stays portable`,
      description: t`Export your complete account whenever you need it. No lock-in.`,
      accent:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      icon: FaArrowDown,
    },
  ];

  const powerpackFeatures = [
    {
      title: t`Save jobs without copying everything manually`,
      description: t`Clip a job posting or paste its URL. ShortlistOS extracts the useful details and creates the opportunity for you.`,
      icon: FaLink,
      accent: "text-violet-600 dark:text-violet-300",
    },
    {
      title: t`Turn job emails into organized opportunities`,
      description: t`Forward job alerts and recruiter emails to your Magic Inbox. ShortlistOS can create new opportunities or update existing ones.`,
      icon: FaInbox,
      accent: "text-blue-600 dark:text-blue-300",
    },
    {
      title: t`Know when something needs attention`,
      description: t`Get reminders for interviews, unanswered applications, overdue follow-ups and opportunities that have gone quiet.`,
      icon: FaBell,
      accent: "text-emerald-600 dark:text-emerald-300",
    },
    {
      title: t`Understand the offer`,
      description: t`See indicative salary ranges based on the role and location when data is available.`,
      icon: FaChartLine,
      accent: "text-amber-600 dark:text-amber-300",
    },
  ];

  const pricingPlans = [
    {
      title: t`Powerpack`,
      price: t`$29`,
      detail: t`for 3 months`,
      cta: primaryCta,
      href: "/settings/powerpack",
      featured: true,
      badge: t`Recommended`,
      items: [
        t`Job-posting import`,
        t`Browser clipper`,
        t`Magic Inbox`,
        t`Salary insights`,
        t`Reminders and nudges`,
        t`Weekly activity digest`,
      ],
    },
    {
      title: t`Free`,
      price: t`$0`,
      detail: t`manual workspace`,
      cta: secondaryCta,
      href: "/signup",
      featured: false,
      items: [
        t`Unlimited shortlists`,
        t`Unlimited opportunities`,
        t`Custom pipelines`,
        t`Notes and attachments`,
        t`Activity timelines`,
        t`Full data export`,
      ],
    },
    {
      title: t`Self-hosted`,
      price: t`Open source`,
      detail: t`run it yourself`,
      cta: t`View on GitHub`,
      href: "https://github.com/petrnagy/shortlistOS",
      compactPrice: true,
      featured: false,
      items: [
        t`Free core application`,
        t`GitHub setup instructions`,
        t`You manage hosting`,
        t`You control updates`,
      ],
    },
  ];

  const faqs = [
    {
      question: t`Is ShortlistOS really free?`,
      answer: t`Yes. The full manual job-search workspace is free to use. Powerpack is optional and adds AI-powered importing, email processing, reminders and automation.`,
    },
    {
      question: t`What happens when Powerpack expires?`,
      answer: t`Your account and opportunities remain available. Powerpack automation stops until it is activated again.`,
    },
    {
      question: t`Is Powerpack a subscription?`,
      answer: t`No. Powerpack costs $29 and remains active for 3 months. It does not renew automatically.`,
    },
    {
      question: t`Can I export my data?`,
      answer: t`Yes. You can export your complete ShortlistOS account as a JSON file at any time.`,
    },
    {
      question: t`Can I self-host ShortlistOS?`,
      answer: t`Yes. The open-source core can be installed from GitHub using the provided setup instructions.`,
    },
    {
      question: t`Where is my data hosted?`,
      answer: t`Account data is hosted in Germany. Uploaded files and attachments are stored in AWS EU North in Stockholm.`,
    },
    {
      question: t`Does ShortlistOS use tracking cookies?`,
      answer: t`No third-party advertising or analytics cookies are used. ShortlistOS may use essential cookies required for authentication and normal application functionality.`,
    },
    {
      question: t`What does the AI process?`,
      answer: t`Powerpack sends only the information required to perform the requested automation, such as extracting structured details from a job posting or processing a forwarded job email.`,
    },
  ];

  return (
    <Layout>
      <PageHead title="ShortlistOS | A better way to manage your job search" />
      <main className="relative z-10 flex w-full flex-col">
        <Hero />
        <TrustStrip />
        <ProductPreview />
        <Section
          eyebrow={t`Workspace`}
          title={t`Your entire job search in one place.`}
          description={t`Move opportunities through your own pipeline, keep notes and files attached to the right role, and see every update in a clear activity timeline.`}
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {workspaceFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </Section>
        <ProblemSection />
        <Section
          id="powerpack"
          eyebrow={t`Powerpack`}
          title={t`Let Powerpack handle the repetitive work.`}
          description={t`Powerpack adds automation and AI to the complete ShortlistOS workspace.`}
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {powerpackFeatures.map((feature) => (
              <AutomationCard key={feature.title} {...feature} />
            ))}
          </div>
        </Section>
        <PricingSection plans={pricingPlans} />
        <PrivacySection />
        <OpenSourceSection />
        <FounderSection />
        <FaqSection faqs={faqs} />
        <FinalCta />
      </main>
    </Layout>
  );
}

function Hero() {
  return (
    <section className="px-4 pt-28 sm:pt-32 lg:pt-36">
      <div className="mx-auto flex max-w-[900px] flex-col items-center text-center">
        <Link
          href="https://github.com/petrnagy/shortlistOS"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-light-300 bg-light-50 px-3 py-1.5 text-xs font-medium text-light-950 shadow-sm hover:bg-light-100 dark:border-dark-300 dark:bg-dark-100 dark:text-dark-950 dark:hover:bg-dark-200"
        >
          <FaGithub className="h-3.5 w-3.5" />
          {t`Open source core`} [todo:shortlistos]
        </Link>
        <h1 className="mt-5 max-w-[900px] text-balance text-5xl font-bold leading-[1.06] tracking-normal text-light-1000 dark:text-dark-1000 sm:text-6xl lg:text-7xl">
          {t`A better way to manage your job search.`}
        </h1>
        <p className="mt-5 max-w-[620px] text-base leading-[1.95rem] text-light-950 dark:text-dark-900 sm:text-lg sm:leading-[2.15rem]">
          {t`Track every opportunity, interview, note and follow-up in one private workspace. Add Powerpack to automatically capture jobs, process emails and remind you what needs attention.`}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
          <LandingButton href="/settings/powerpack" variant="primary">
            {primaryCta}
          </LandingButton>
          <LandingButton href="/signup" variant="secondary">
            {secondaryCta}
          </LandingButton>
        </div>
        <p className="mt-4 text-sm text-light-900 dark:text-dark-800">
          {t`3 months of automation & AI for $29 · No recurring payments`}
        </p>
        <Link
          href="https://github.com/petrnagy/shortlistOS"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-sm font-medium text-light-1000 underline decoration-light-500 underline-offset-4 hover:decoration-light-1000 dark:text-dark-1000 dark:decoration-dark-500 dark:hover:decoration-dark-1000"
        >
          {t`Prefer to run it yourself? Self-host the open-source version.`}
        </Link>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { label: t`Open source core`, icon: FaGithub },
    { label: t`Made and hosted in the EU`, icon: FaGlobeEurope },
    { label: t`No tracking cookies`, icon: FaShieldAlt },
    { label: t`Export your data anytime`, icon: FaArrowDown },
  ];

  return (
    <section className="px-4 pt-10">
      <div className="mx-auto grid max-w-[960px] gap-px overflow-hidden rounded-xl border border-light-300 bg-light-300 shadow-sm dark:border-dark-300 dark:bg-dark-300 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-center gap-3 bg-light-50 px-5 py-4 text-sm font-medium text-light-950 dark:bg-dark-100 dark:text-dark-950"
          >
            <item.icon className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductPreview() {
  const columns = [
    {
      name: t`Wishlist`,
      count: 7,
      cards: [t`Senior Product Manager`, t`Staff Engineer`, t`Design Lead`],
    },
    {
      name: t`Applied`,
      count: 5,
      cards: [t`Backend Engineer`, t`Product Designer`, t`Founding Engineer`],
    },
    {
      name: t`Interview`,
      count: 3,
      cards: [
        t`Senior Software Engineer`,
        t`Engineering Manager`,
        t`Staff Engineer`,
      ],
    },
    {
      name: t`Offer`,
      count: 1,
      cards: [t`Software Engineer`],
    },
    {
      name: t`Closed`,
      count: 2,
      cards: [t`Product Manager`, t`Senior Engineer`],
    },
  ];

  return (
    <section id="product" className="px-4 py-10 lg:py-14">
      <div className="mx-auto overflow-hidden rounded-2xl border border-light-300 bg-light-50 shadow-[0_20px_80px_rgba(15,23,42,0.10)] dark:border-dark-300 dark:bg-dark-100 dark:shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-light-300 px-5 py-4 dark:border-dark-300">
          <div>
            <p className="text-sm font-bold text-light-1000 dark:text-dark-1000">
              shortlistOS
            </p>
            <p className="text-xs text-light-900 dark:text-dark-800">
              {t`Pipeline`}
            </p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-light-900 dark:text-dark-800 sm:flex">
            <span className="rounded-md bg-violet-100 px-2 py-1 font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              {t`Board`}
            </span>
            <span>{t`List`}</span>
            <span>{t`Timeline`}</span>
          </div>
          <button className="rounded-md bg-light-1000 px-3 py-2 text-xs font-semibold text-light-50 dark:bg-dark-1000 dark:text-dark-50">
            {t`Add opportunity`}
          </button>
        </div>
        <div className="grid min-h-[430px] grid-cols-1 bg-light-100 dark:bg-dark-50 lg:grid-cols-[190px_1fr]">
          <aside className="hidden border-r border-light-300 bg-light-50/80 p-5 text-sm dark:border-dark-300 dark:bg-dark-100/80 lg:block">
            <div className="space-y-2 text-light-900 dark:text-dark-800">
              {[t`Search`, t`Inbox`, t`Pipeline`, t`Calendar`, t`Tasks`].map(
                (item, index) => (
                  <div
                    key={item}
                    className={`rounded-md px-3 py-2 ${
                      index === 2
                        ? "bg-violet-100 font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                        : ""
                    }`}
                  >
                    {item}
                  </div>
                ),
              )}
            </div>
          </aside>
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[850px] grid-cols-5 gap-4">
              {columns.map((column) => (
                <div
                  key={column.name}
                  className="rounded-xl bg-light-200 p-3 dark:bg-dark-200"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
                      {column.name}
                    </h3>
                    <span className="text-xs text-light-900 dark:text-dark-800">
                      {column.count}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {column.cards.map((card, index) => (
                      <div
                        key={card}
                        className="rounded-lg border border-light-300 bg-light-50 p-3 shadow-sm dark:border-dark-300 dark:bg-dark-100"
                      >
                        <p className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
                          {card}
                        </p>
                        <p className="mt-2 text-xs text-light-900 dark:text-dark-800">
                          {index % 2 === 0 ? t`Remote` : t`Hybrid`}
                        </p>
                        <p className="mt-3 text-xs text-light-900 dark:text-dark-800">
                          {index === 0 ? t`Added 5d ago` : t`Interview in 1w`}
                        </p>
                      </div>
                    ))}
                    <button className="w-full rounded-lg border border-dashed border-light-400 py-3 text-xs font-medium text-light-900 dark:border-dark-400 dark:text-dark-800">
                      {t`Add opportunity`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="px-4 py-14">
      <div className="mx-auto grid max-w-[980px] gap-8 rounded-2xl border border-light-300 bg-light-50 p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100 md:grid-cols-[2fr_1fr] md:p-9">
        <div>
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-300">
            {t`The problem`}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
            {t`Job searching becomes chaotic surprisingly quickly.`}
          </h2>
          <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
            {t`A few applications turn into dozens of tabs, emails, documents, interview dates and half-finished follow-ups.`}
          </p>
        </div>
        <div className="grid gap-3">
          {[
            t`what you applied for`,
            t`where each opportunity stands`,
            t`what happened last`,
            t`what you need to do next`,
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-xl border border-light-300 bg-light-100 p-4 text-sm font-medium text-light-1000 dark:border-dark-300 dark:bg-dark-50 dark:text-dark-1000"
            >
              <FaCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({
  plans,
}: {
  plans: {
    title: string;
    price: string;
    detail: string;
    cta: string;
    href: string;
    featured: boolean;
    compactPrice?: boolean;
    badge?: string;
    items: string[];
  }[];
}) {
  return (
    <Section
      id="pricing"
      eyebrow={t`Pricing`}
      title={t`Use ShortlistOS your way.`}
      description={t`Choose the hosted workspace with automation, keep it manual for free, or run the open-source core yourself.`}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.title}
            className={`relative flex min-h-[420px] flex-col rounded-2xl border p-6 shadow-sm ${
              plan.featured
                ? "border-violet-300 bg-light-50 shadow-[0_16px_50px_rgba(124,58,237,0.18)] dark:border-violet-500/50 dark:bg-dark-100"
                : "border-light-300 bg-light-50 dark:border-dark-300 dark:bg-dark-100"
            }`}
          >
            {plan.badge && (
              <span className="absolute right-5 top-5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                {plan.badge}
              </span>
            )}
            <h3 className="text-xl font-bold text-light-1000 dark:text-dark-1000">
              {plan.title}
            </h3>
            <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
              <span
                className={`font-bold leading-[1.1] text-light-1000 dark:text-dark-1000 ${
                  plan.compactPrice ? "text-3xl" : "text-4xl"
                }`}
              >
                {plan.price}
              </span>
              <span className="pb-1 text-sm leading-[1.55] text-light-900 dark:text-dark-800">
                {plan.detail}
              </span>
            </div>
            <ul className="mt-6 space-y-3 pb-6">
              {plan.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-sm leading-[1.55rem] text-light-950 dark:text-dark-900"
                >
                  <FaCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  {item}
                </li>
              ))}
            </ul>
            <LandingButton
              href={plan.href}
              variant={plan.featured ? "primary" : "secondary"}
              className="mt-auto w-full"
              external={plan.href.startsWith("http")}
            >
              {plan.cta}
            </LandingButton>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PrivacySection() {
  return (
    <section id="privacy" className="px-4 py-14">
      <div className="mx-auto grid max-w-[980px] items-center gap-8 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-300">
            {t`Privacy`}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
            {t`Your job search is personal. Your data should be too.`}
          </h2>
          <div className="mt-5 space-y-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
            <p>
              {t`ShortlistOS does not use advertising trackers or third-party analytics cookies. Your data is not sold to advertisers.`}
            </p>
            <p>
              {t`Account data is hosted in Germany. Uploaded files are stored in AWS EU North, Stockholm.`}
            </p>
            <p>
              {t`Powerpack uses Mistral, a European AI provider, to process supported automation features.`}
            </p>
          </div>
          <Link
            href="/privacy"
            className="mt-5 inline-flex text-sm font-semibold text-light-1000 underline decoration-light-500 underline-offset-4 hover:decoration-light-1000 dark:text-dark-1000 dark:decoration-dark-500"
          >
            {t`Read the privacy details`}
          </Link>
        </div>
        <div className="rounded-2xl border border-light-300 bg-light-50 p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t`Hosted in Germany`, icon: FaGlobeEurope },
              { label: t`EU file storage`, icon: FaShieldAlt },
              { label: t`No ad tracking`, icon: FaLock },
              { label: t`Export anytime`, icon: FaArrowDown },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-light-100 p-5 dark:bg-dark-50"
              >
                <item.icon className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                <p className="mt-4 text-sm font-semibold text-light-1000 dark:text-dark-1000">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OpenSourceSection() {
  return (
    <section className="px-4 py-14">
      <div className="mx-auto grid max-w-[980px] gap-8 rounded-2xl border border-light-300 bg-light-50 p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100 md:grid-cols-[2fr_1fr] md:p-9">
        <div>
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-300">
            {t`Open source`}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
            {t`Trust the code, not just the promises.`}
          </h2>
          <p className="mt-5 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
            {t`The ShortlistOS core is open source. You can inspect the code, review how the product works, contribute improvements, or host it yourself.`}
          </p>
          <LandingButton
            href="https://github.com/petrnagy/shortlistOS"
            external
            variant="secondary"
            className="mt-6"
          >
            {t`Explore the source code`}
          </LandingButton>
        </div>
        <div className="grid content-center gap-3">
          {[t`Open source core`, t`Self-hostable`, t`Portable data`].map(
            (item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl bg-light-100 p-4 text-sm font-semibold text-light-1000 dark:bg-dark-50 dark:text-dark-1000"
              >
                <FaCode className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                {item}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function FounderSection() {
  return (
    <section className="px-4 py-14">
      <div className="mx-auto grid max-w-[980px] items-center gap-8 md:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-300">
            {t`Indie`}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
            {t`Built independently, for people doing an already difficult job.`}
          </h2>
          <p className="mt-5 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
            {t`ShortlistOS is an independent product made in the EU by a real person, not a venture-backed recruitment platform, advertising network or data-harvesting business.`}
          </p>
          <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
            {t`The goal is simple: make the process calmer, clearer and easier to control.`}
          </p>
          <p className="mt-5 text-sm font-semibold text-light-1000 dark:text-dark-1000">
            {t`Petr Nagy, creator of ShortlistOS`}
          </p>
        </div>
        <div className="rounded-2xl border border-light-300 bg-light-50 p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100">
          {[
            t`Independently built and funded`,
            t`Privacy-first by design`,
            t`Open source core`,
            t`Made in the EU`,
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 border-b border-light-300 py-4 text-sm font-medium text-light-950 last:border-0 dark:border-dark-300 dark:text-dark-900"
            >
              <FaCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  return (
    <Section
      id="faq"
      eyebrow={t`Questions`}
      title={t`FAQ`}
      description={t`The practical things people usually want to know before trusting a product with their job search.`}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {faqs.map((faq) => (
          <div
            key={faq.question}
            className="rounded-2xl border border-light-300 bg-light-50 p-5 shadow-sm dark:border-dark-300 dark:bg-dark-100"
          >
            <h3 className="text-base font-bold text-light-1000 dark:text-dark-1000">
              {faq.question}
            </h3>
            <p className="mt-3 text-sm leading-[1.65rem] text-light-950 dark:text-dark-900">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 py-20 text-center">
      <div className="mx-auto max-w-[680px]">
        <p className="text-sm font-semibold text-violet-600 dark:text-violet-300">
          {t`Get started`}
        </p>
        <h2 className="mt-3 text-4xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-5xl">
          {t`Stop managing your job search from memory.`}
        </h2>
        <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
          {t`Keep every opportunity organized and let Powerpack handle the repetitive parts.`}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LandingButton href="/settings/powerpack" variant="primary">
            {primaryCta}
          </LandingButton>
          <LandingButton href="/signup" variant="secondary">
            {secondaryCta}
          </LandingButton>
        </div>
        <p className="mt-4 text-sm text-light-900 dark:text-dark-800">
          {t`One payment. 3 months of Powerpack. No automatic renewal.`}
        </p>
      </div>
    </section>
  );
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="px-4 py-14">
      <div className="mx-auto max-w-[980px]">
        <div className="mx-auto max-w-[680px] text-center">
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-300">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
            {description}
          </p>
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  description,
  accent,
  icon: Icon,
}: {
  title: string;
  description: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-light-300 bg-light-50 p-5 shadow-sm dark:border-dark-300 dark:bg-dark-100">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-base font-bold leading-[1.45] text-light-1000 dark:text-dark-1000">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-[1.65rem] text-light-950 dark:text-dark-900">
        {description}
      </p>
    </div>
  );
}

function AutomationCard({
  title,
  description,
  accent,
  icon: Icon,
}: {
  title: string;
  description: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-light-300 bg-light-50 p-5 shadow-sm transition-transform hover:-translate-y-1 dark:border-dark-300 dark:bg-dark-100">
      <Icon className={`h-7 w-7 ${accent}`} />
      <h3 className="mt-5 text-base font-bold leading-[1.45] text-light-1000 dark:text-dark-1000">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-[1.65rem] text-light-950 dark:text-dark-900">
        {description}
      </p>
    </div>
  );
}

function LandingButton({
  href,
  variant,
  children,
  className = "",
  external = false,
}: {
  href: string;
  variant: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}) {
  const classes =
    variant === "primary"
      ? "rounded-lg bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500"
      : "rounded-lg border border-light-400 bg-light-50 px-5 py-3 text-sm font-bold text-light-1000 shadow-sm transition hover:bg-light-100 dark:border-dark-400 dark:bg-dark-100 dark:text-dark-1000 dark:hover:bg-dark-200";

  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`${classes} ${className}`}
    >
      {children}
    </Link>
  );
}
