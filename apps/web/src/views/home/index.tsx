import Link from "next/link";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { t } from "@lingui/core/macro";
import {
  FaBell,
  FaChartLine,
  FaCheck,
  FaGithub,
  FaGlobeEurope,
  FaHistory,
  FaLink,
  FaLock,
  FaShieldAlt,
} from "react-icons/fa";
import {
  FaArrowsToCircle,
  FaFolderTree,
  FaTimeline,
  FaTrello,
} from "react-icons/fa6";
import { HiMiniMinusSmall, HiMiniPlusSmall } from "react-icons/hi2";

import type { PricingPlan } from "../pricing/components/PricingCards";
import { PageHead } from "~/components/PageHead";
import { env } from "~/env";
import {
  getPricingPlans,
  PricingCards,
} from "../pricing/components/PricingCards";
import FinalCta from "./components/FinalCta";
import { FeatureCard, Section } from "./components/LandingSection";
import Layout from "./components/Layout";

const primaryCta = t`Get the Powerpack`;
const secondaryCta = t`Create free account`;
const powerpackSignupHref = "/signup?withPowerpack=yes";
const githubUrl = env.NEXT_PUBLIC_GITHUB_URL ?? "#";

export default function HomeView() {
  const workspaceFeatures = [
    {
      title: t`A pipeline built specifically for job hunting`,
      description: t`Every opportunity follows a clear path from inbox to application, interview, offer, and final outcome.`,
      accent:
        "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
      icon: FaTimeline,
    },
    {
      title: t`One source of truth for every opportunity`,
      description: t`Keep the job description, company details, salary, contacts, notes, files, and interview dates together.`,
      accent:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      icon: FaArrowsToCircle,
    },
    {
      title: t`Your whole search at a glance`,
      description: t`See every active opportunity, where it stands, and what needs attention.`,
      accent:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      icon: FaTrello,
    },
    {
      title: t`A complete history of what happened`,
      description: t`Review emails, comments, milestones, and status changes in chronological order without losing context.`,
      accent:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      icon: FaHistory,
    },
  ];

  const powerpackFeatures = [
    {
      title: t`Save jobs in seconds`,
      description: t`Use the browser clipper on a job posting. shortlistOS extracts the important details and creates a complete opportunity for you.`,
      icon: FaLink,
      accent:
        "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
    },
    {
      title: t`Turn job emails into organized opportunities`,
      description: t`Forward job alerts and recruiter emails to your Magic Inbox. shortlistOS can create new opportunities or update existing ones automatically.`,
      icon: FaFolderTree,
      accent:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    },
    {
      title: t`Know what needs your attention`,
      description: t`Get reminders for upcoming interviews, unanswered applications, overdue follow-ups, and opportunities that have gone quiet.`,
      icon: FaBell,
      accent:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    {
      title: t`Know what the role is worth`,
      description: t`See indicative salary ranges based on the role and location, with regional comparisons when data is available.`,
      icon: FaChartLine,
      accent:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
  ];

  const pricingPlans = getPricingPlans();

  const faqs = [
    {
      question: t`Is shortlistOS really free?`,
      answer: t`Yes. The base version is completely free, including unlimited shortlists, unlimited opportunities, notes, attachments, activity history, and data export. Powerpack is optional and adds automation and AI features.`,
    },
    {
      question: t`What is Powerpack?`,
      answer: t`Powerpack adds tools that take care of repetitive work. The browser clipper lets you save a job posting directly from your browser and turns its key details into an organized opportunity. With Magic Inbox, you can forward job alerts and recruiter emails to create new opportunities or update existing ones automatically. Powerpack also adds reminders, follow-up nudges, and salary insights to help you keep your search moving.`,
    },
    {
      question: t`Is Powerpack a subscription?`,
      answer: t`No. Powerpack costs $29 and remains active for three months. There is no automatic renewal or recurring payment.`,
    },
    {
      question: t`Do I need Powerpack to use shortlistOS?`,
      answer: t`No. The free base version gives you everything you need to organize and track your job search. Powerpack is optional and adds automation and AI features that reduce repetitive work.`,
    },
    {
      question: t`What happens when Powerpack expires?`,
      answer: t`Your account, opportunities, notes, and files remain available. Your account returns to the base version, and Powerpack features stop until you activate it again.`,
    },
    {
      question: t`Can I export my data?`,
      answer: t`Yes. You can export your complete account as a JSON file at any time.`,
    },
    {
      question: t`Can I self-host shortlistOS?`,
      answer: t`Yes. The open-source core can be installed and run on your own infrastructure using the instructions on GitHub. You are responsible for hosting, configuration, updates, and backups.`,
    },
    {
      question: t`Can I use Powerpack with a self-hosted installation?`,
      answer: t`Yes. Powerpack and all of its features are open source and included with the rest of the shortlistOS code on GitHub. With the required infrastructure and configuration, you can self-host the complete application, including its automation and AI features.`,
    },
    {
      question: t`Where is my data hosted?`,
      answer: t`Account data is hosted in Germany. Uploaded files and attachments are stored on AWS in Stockholm. Some Powerpack features send the relevant content to Mistral for processing, such as the contents of a clipped job posting or an email forwarded to Magic Inbox.`,
    },
    {
      question: t`Can shortlistOS automatically apply to jobs for me?`,
      answer: t`No. shortlistOS makes the job search process much more convenient, but it cannot do the actual legwork for you. No one can—and anyone who claims otherwise is misleading you.`,
    },
    {
      question: t`Can I manage more than one job search?`,
      answer: t`Yes. You can create unlimited shortlists and keep separate searches organized by role, industry, location, or however else you prefer.`,
    },
  ];

  return (
    <Layout>
      <PageHead title="shortlistOS | Job hunting is hard. Tracking it shouldn't be." />
      <main className="relative z-10 flex w-full flex-col">
        <Hero />
        <TrustStrip />
        <ProductPreview />
        <Section
          eyebrow={t`Workspace`}
          title={t`Your entire job search in one place.`}
          description={t`Keep every opportunity, email, note, and file together. Follow a purpose-built pipeline and see exactly where your search stands.`}
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {workspaceFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </Section>

        <Section
          id="powerpack"
          eyebrow={t`Powerpack`}
          title={t`Let Powerpack handle the repetitive work.`}
          description={t`Powerpack adds automation and AI to your shortlistOS workspace, so you spend less time copying information and more time moving your search forward.`}
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {powerpackFeatures.map((feature) => (
              <AutomationCard key={feature.title} {...feature} />
            ))}
          </div>
        </Section>
        <PricingSection plans={pricingPlans} />
        <PrivacyOpenSourceSection />
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
        <h1 className="mt-5 max-w-[900px] text-balance text-5xl font-bold leading-[1.06] tracking-normal text-light-1000 dark:text-dark-1000 sm:text-6xl lg:text-7xl">
          {t`Job hunting is hard. Tracking it shouldn't be.`}
        </h1>
        <p className="mt-5 max-w-[620px] text-base leading-[1.95rem] text-light-950 dark:text-dark-900 sm:text-lg sm:leading-[2.15rem]">
          {t`Track every opportunity, email, scheduled interview, and follow-up in one private workspace. Get the Powerpack to automate your search.`}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="flex w-full flex-col items-center sm:w-44">
            <LandingButton
              href="/signup"
              variant="secondary"
              className="w-full"
            >
              {secondaryCta}
            </LandingButton>
          </div>
          <div className="flex w-full flex-col items-center sm:w-44">
            <LandingButton
              href={powerpackSignupHref}
              variant="primary"
              dynamicBackground
              className="w-full"
            >
              {primaryCta}
            </LandingButton>
            <p className="mt-2 text-xs leading-5 text-light-900 dark:text-dark-800">
              {t`3 months for $29 · No recurring payments`}
            </p>
          </div>
        </div>
        <Link
          href={githubUrl}
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
    { label: t`Made & hosted in EU`, icon: FaGlobeEurope },
    { label: t`Privacy friendly`, icon: FaShieldAlt },
    { label: t`Own your data`, icon: FaLock },
  ];

  return (
    <section className="px-4 pt-10">
      <div className="mx-auto grid max-w-[850px] gap-px overflow-hidden rounded-xl border border-light-300 bg-light-300 shadow-sm dark:border-dark-300 dark:bg-dark-300 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-center gap-3 bg-light-50 px-5 py-4 text-sm font-medium text-light-950 dark:bg-dark-100 dark:text-dark-950"
          >
            <item.icon className="text-brand-600 dark:text-brand-300 h-4 w-4" />
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
    <section id="product" className="scroll-mt-20 px-4 py-10 lg:py-14">
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
            <span className="bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 rounded-md px-2 py-1 font-medium">
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
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 font-semibold"
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

function PricingSection({ plans }: { plans: PricingPlan[] }) {
  return (
    <Section
      id="pricing"
      eyebrow={t`Pricing`}
      title={t`Use shortlistOS your way.`}
      description={t`Choose Powerpack for automation, use the full workspace for free, or self-host the open-source core.`}
    >
      <PricingCards plans={plans} />
      <div className="mt-6 text-center">
        <Link
          href="/pricing#compare-features"
          className="hover:text-brand-700 dark:hover:text-brand-300 text-sm font-bold text-light-1000 underline underline-offset-4 dark:text-dark-1000"
        >
          {t`Compare features`}
        </Link>
      </div>
    </Section>
  );
}

function PrivacyOpenSourceSection() {
  const privacyItems = [
    t`No advertising or personal tracking`,
    t`Your data is never sold`,
    t`Export your complete account anytime`,
    t`Account data hosted in the EU`,
  ];
  const openSourceItems = [
    t`Inspect exactly how the product works`,
    t`Self-host the core application`,
    t`Modify it for your own needs`,
    t`Avoid vendor lock-in`,
  ];

  return (
    <section id="privacy" className="scroll-mt-20 px-4 py-14">
      <div className="mx-auto max-w-[980px]">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="bg-brand-600 inline-flex rounded-full px-3 py-1 text-sm font-semibold text-white">
            {t`Privacy & open source`}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
            {t`Private by design. Open by default.`}
          </h2>
          <p className="mt-5 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
            {t`shortlistOS does not track you, sell your data, or lock it away. Export your account whenever you want, inspect the source code, or run the core application yourself.`}
          </p>
        </div>
        <div className="mx-auto mt-9 grid w-fit gap-9 text-left md:grid-cols-[auto_1px_auto] md:gap-10">
          <div className="w-fit md:ps-2">
            <h3 className="text-base font-bold text-light-1000 dark:text-dark-1000">
              {t`Privacy`}
            </h3>
            <div className="mt-4 space-y-3">
              {privacyItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm leading-[1.55rem] text-light-950 dark:text-dark-900"
                >
                  <FaCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden bg-light-500 dark:bg-dark-500 md:block" />
          <div className="w-fit md:ps-2">
            <h3 className="text-base font-bold text-light-1000 dark:text-dark-1000">
              {t`Open source`}
            </h3>
            <div className="mt-4 space-y-3">
              {openSourceItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm leading-[1.55rem] text-light-950 dark:text-dark-900"
                >
                  <FaCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <LandingButton href={githubUrl} external variant="secondary">
            {t`Explore the source code`}
          </LandingButton>
        </div>
        <div className="mt-4 text-center">
          <Link
            href="/privacy"
            className="hover:text-brand-700 dark:hover:text-brand-300 text-sm font-bold text-light-1000 underline underline-offset-4 dark:text-dark-1000"
          >
            {t`Privacy policy`}
          </Link>
        </div>
      </div>
    </section>
  );
}
function FounderSection() {
  return (
    <section className="px-4 py-14">
      <div className="mx-auto max-w-[720px] text-center">
        <h2 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
          {t`Built independently, for people doing an already difficult job.`}
        </h2>
        <p className="mt-5 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
          {t`shortlistOS is an independent product—not a recruitment platform, advertising network, or venture-backed growth company.`}
        </p>
        <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
          {t`There are no ads, no data sales, and no incentive to keep you job hunting longer than necessary. The goal is simple: make your search easier, respect your privacy, and get out of the way.`}
        </p>
        <p className="mt-5 text-right text-sm font-semibold text-light-1000 dark:text-dark-1000">
          {t`— Petr, maker of shortlistOS`}
        </p>
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
    <section id="faq" className="scroll-mt-20 px-4 py-14">
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-col items-center justify-center pb-12 text-center">
          <p className="bg-brand-600 inline-flex rounded-full px-3 py-1 text-sm font-semibold text-white">
            {t`FAQs`}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
            {t`Questions?`}
          </h2>
          <p className="mt-3 max-w-[560px] text-base leading-[1.75rem] text-light-950 dark:text-dark-900">
            {t`Find answers to common questions about shortlistOS before trusting it with your job search.`}
          </p>
        </div>
        <div className="rounded-2xl bg-light-50 ring-1 ring-light-300 dark:bg-dark-50 dark:ring-dark-200">
          <div className="mx-auto px-6 py-10 lg:px-16 lg:py-16">
            <dl className="divide-y divide-light-300 dark:divide-dark-200">
              {faqs.map((faq) => (
                <Disclosure
                  key={faq.question}
                  as="div"
                  className="py-5 first:pt-0 last:pb-0"
                >
                  <dt>
                    <DisclosureButton className="group flex w-full items-center justify-between text-left text-light-1000 dark:text-dark-1000">
                      <span className="text-[14px] font-semibold">
                        {faq.question}
                      </span>
                      <span className="ml-6 flex h-7 items-center text-light-800 dark:text-dark-800">
                        <HiMiniPlusSmall
                          aria-hidden="true"
                          className="size-6 group-data-[open]:hidden"
                        />
                        <HiMiniMinusSmall
                          aria-hidden="true"
                          className="size-6 group-[&:not([data-open])]:hidden"
                        />
                      </span>
                    </DisclosureButton>
                  </dt>
                  <DisclosurePanel as="dd" className="mt-2 pr-12">
                    <p className="text-[14px] leading-[1.7rem] text-light-800 dark:text-dark-800">
                      {faq.answer}
                    </p>
                  </DisclosurePanel>
                </Disclosure>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
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

function LandingButton({
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
