import Link from "next/link";
import { t } from "@lingui/core/macro";

import { authClient } from "@kan/auth/client";

import FeedbackForm from "~/components/FeedbackForm";
import { PageHead } from "~/components/PageHead";
import Layout from "~/views/home/components/Layout";

export default function ContactPage() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <Layout>
      <PageHead title={`${t`Contact`} | shortlistOS`} />
      <section className="px-4 pb-20 pt-28">
        <div className="mx-auto max-w-[680px]">
          <h1 className="text-center text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
            {t`Contact us`}
          </h1>
          <p className="mb-8 mt-4 text-center text-base leading-[1.8rem] text-light-900 dark:text-dark-800">
            {t`Need help?`}
          </p>

          {isPending ? null : session?.user ? (
            <FeedbackForm standalone />
          ) : (
            <div className="rounded-xl border border-light-300 bg-white p-6 text-center dark:border-dark-300 dark:bg-dark-100">
              <div className="space-y-3 text-sm leading-6 text-light-900 dark:text-dark-800">
                <p>
                  <Link
                    href="/login?next=%2Fcontact"
                    className="font-semibold text-blue-600 underline dark:text-blue-300"
                  >
                    {t`Sign in`}
                  </Link>
                </p>
                <p>
                  <a
                    href="mailto:support@shortlistos.co"
                    className="font-semibold text-blue-600 underline dark:text-blue-300"
                  >
                    support@shortlistos.co
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
