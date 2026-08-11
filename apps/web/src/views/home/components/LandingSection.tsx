import type { ComponentType, ReactNode } from "react";

export function Section({
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
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 px-4 py-14">
      <div className="mx-auto max-w-[980px]">
        <div className="mx-auto max-w-[680px] text-center">
          <p className="bg-brand-600 inline-flex rounded-full px-3 py-1 text-sm font-semibold text-white">
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

export function FeatureCard({
  title,
  description,
  accent = "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  icon: Icon,
}: {
  title: string;
  description: string;
  accent?: string;
  icon: ComponentType<{ className?: string }>;
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
