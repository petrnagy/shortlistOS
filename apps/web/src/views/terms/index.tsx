import type { ReactNode } from "react";
import { isValidElement } from "react";
import ReactMarkdown from "react-markdown";

import { PageHead } from "~/components/PageHead";
import type { LegalDocument } from "~/utils/legal-content";
import Layout from "../home/components/Layout";

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }

  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return getNodeText(props.children);
  }

  return "";
}

function isOperatorDetailsList(children: ReactNode) {
  const text = getNodeText(children);

  return text.includes("Website:") && text.includes("Email:");
}

type TermsViewProps = {
  content: LegalDocument;
};

export default function TermsView({ content }: TermsViewProps) {
  return (
    <Layout>
      <PageHead title={`${content.title} | shortlistOS`} />
      <div className="mb-20">
        <section className="scroll-mt-20 px-4 pb-14 pt-28">
          <div className="mx-auto max-w-[980px]">
            <div className="mx-auto max-w-[680px] text-center">
              <h1 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
                {content.title}
              </h1>
              <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
                Effective date: {content.effectiveDate}
              </p>
            </div>

            <div className="mt-10">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => (
                    <h2 className="mb-4 mt-10 text-2xl font-bold text-light-1000 dark:text-dark-950">
                      {children}
                    </h2>
                  ),
                  p: ({ children }) => (
                    <p className="mb-4 text-base leading-[1.8rem] text-light-1000 dark:text-dark-900">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul
                      className={
                        isOperatorDetailsList(children)
                          ? "mb-4 list-none space-y-0.5 pl-3 text-light-1000 dark:text-dark-900 [&_li]:leading-[1.45rem]"
                          : "mb-4 list-disc space-y-2 pl-6 text-light-1000 dark:text-dark-900"
                      }
                    >
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => (
                    <li className="text-base leading-[1.8rem]">{children}</li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="mb-6 border-l-2 border-light-500 pl-4 text-light-1000 dark:border-dark-400 dark:text-dark-900">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {content.markdown}
              </ReactMarkdown>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
