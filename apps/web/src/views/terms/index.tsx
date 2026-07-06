import type { ReactNode } from "react";
import { isValidElement } from "react";
import ReactMarkdown from "react-markdown";

import { PageHead } from "~/components/PageHead";
import Layout from "../home/components/Layout";

const termsOfUseMarkdown = `
These Terms of Use govern your access to and use of the **Service**. By creating an account, purchasing Powerpack, or otherwise using the Service, you agree to these Terms.

## 1. The Service and its operator

For the purposes of these Terms, the **Service** means the shortlistOS website, the hosted shortlistOS application, Powerpack, Magic Inbox, the Web Clipper, hosted APIs, and related service subdomains operated by:

- **Petr Nagy**
- Mariánské nám. 5
- 110 00 Staré Město
- Prague, Czechia
- IČO: 88074625
- Website: petrnagy.cz
- Email: privacy@shortlistos.co

The Service is designed primarily as a job-search organization tool for individual job seekers. It is not an employment agency, recruiter, career adviser, or enterprise service.

These Terms apply only to the Service hosted and operated by Petr Nagy.

They do **not** apply to the shortlistOS source code, independently self-hosted installations, third-party forks, or services operated by anyone else. Those are governed by their applicable open-source licences and by the terms and privacy practices of their respective operators. Petr Nagy is not responsible for third-party or self-hosted instances.

## 2. Eligibility and accounts

You must be at least 16 years old to use the Service.

You must provide a working email address and keep access to your account secure. You are responsible for activity performed through your account unless it results from a security failure caused by the Service.

You must not:

- impersonate another person;
- create an account using an email address you are not entitled to use;
- share access in a way that compromises account security; or
- use automated systems to create or operate accounts without permission.

You should notify us promptly if you believe your account has been accessed without authorization.

## 3. What the Service provides

shortlistOS is a smart Kanban-style workspace for organizing a job search. Features may include:

- job-opportunity cards and pipelines;
- notes, files, contacts, reminders, and activity history;
- Magic Inbox;
- the Web Clipper;
- AI-assisted extraction and updates;
- salary and company information; and
- other free or Powerpack features made available from time to time.

Some features are free. Others require an active Powerpack period.

The calendar provided inside shortlistOS is an internal feature. It does not connect to or access your external calendars.

## 4. Powerpack

Powerpack costs **USD 29 as a one-time payment** and provides access to Powerpack functionality for **three months** from activation. The exact expiry date is shown in your account.

Powerpack is not a subscription and does not renew automatically.

Powerpack is activated after payment is successfully processed, normally immediately or within a few minutes.

Payments are processed by Stripe. We do not receive or store your full payment-card details.

Prices for future purchases may change. A price change will not shorten or otherwise affect an already active Powerpack period.

## 5. Refunds and withdrawal

You may request a **full refund within 14 days of purchasing Powerpack**, without giving a reason. No payment-processing fee will be deducted from that refund.

To request a refund or withdraw from the purchase, send a clear statement through the support contact provided in the Service or to the contact address listed in these Terms. You may use the model form at the end of these Terms, but you are not required to do so.

We will issue an eligible refund to the original payment method without undue delay and no later than 14 days after receiving the request. Your bank or payment provider may take additional time to display the refund.

Powerpack access may be disabled when the refund is issued.

Refund requests submitted more than 14 days after purchase are considered individually and are not guaranteed.

Deleting your account does not automatically create a right to a refund. If the purchase is still within the 14-day refund period, you may request the full refund separately. Later requests may be considered individually.

If we permanently discontinue Powerpack before your paid period ends, we will provide a proportional refund for the unused part of that period.

No refund is required where an account is suspended or terminated because of a serious violation of these Terms, except where applicable law requires otherwise.

Nothing in this section limits any mandatory consumer rights that apply to you.

## 6. Your content

You retain ownership of the content you add to the Service.

You grant us a non-exclusive, royalty-free licence to host, store, reproduce, process, transmit, and display your content only as necessary to:

- operate and secure the Service;
- provide the features you request;
- create backups;
- process content through relevant service providers; and
- provide support or troubleshoot technical problems.

This licence allows our service providers to process your content on our behalf only where necessary to provide their services to us.

The licence ends when you delete the content or your account, except where copies temporarily remain in backups or must be retained for a legal reason.

You are responsible for the content you add. You must have the right to use it and must not upload content that is unlawful, infringes another person's rights, or contains confidential or sensitive information that you are not allowed to share.

Content stored in your account is private and is not published to other shortlistOS users.

## 7. AI, automation, and third-party information

AI and automation features may extract information or add and update fields on your job-opportunity cards. You can review, change, or delete those results.

These features do not make hiring decisions, assess your legal eligibility for employment, or make decisions with legal or similarly significant effects.

AI-generated results, salary information, company information, extracted content, reminders, and suggestions may be incomplete, outdated, or incorrect. You are responsible for reviewing information before relying on it.

The Service does not guarantee:

- employment, interviews, offers, or other job-search results;
- the accuracy of AI-generated or automatically extracted information;
- the accuracy or completeness of salary or company data;
- that a job posting is genuine, current, lawful, or still available; or
- that reminders, deadlines, emails, or automated updates will always be delivered or processed correctly.

The Service is an organizational tool and does not provide legal, financial, tax, recruitment, or professional career advice.

Some features rely on third-party providers. Their availability, outputs, and processing may be subject to their own terms and technical limitations.

## 8. Acceptable use

You must not use the Service to:

- break the law or help another person break the law;
- harass, threaten, defraud, abuse, or impersonate anyone;
- send spam or unsolicited bulk messages;
- upload malware, malicious code, or harmful content;
- attack, disrupt, overload, or interfere with the Service;
- bypass authentication, rate limits, access controls, or security measures;
- probe or access accounts, systems, or data without authorization;
- scrape, harvest, or systematically extract data from the hosted Service without permission;
- misuse Magic Inbox, the Web Clipper, APIs, or email infrastructure;
- infringe intellectual-property, privacy, confidentiality, or other rights;
- resell or provide unauthorized access to the hosted Service; or
- reverse-engineer or access non-public parts of the hosted Service, except where applicable law or an applicable open-source licence expressly permits it.

You must not use the Service as the sole place where you keep important information. You should maintain your own copies or regularly export your data.

## 9. Intellectual property

Your content remains yours as described above.

Rights in the shortlistOS name, branding, logos, website content, documentation, and hosted-service materials belong to Petr Nagy or their respective licensors, except where expressly released under an open-source licence.

Source code made available under an open-source licence is governed by that licence. These Terms do not restrict rights expressly granted by the applicable open-source licence.

Using the hosted Service does not transfer ownership of the Service, its branding, or its underlying technology to you.

## 10. Service availability and changes

We aim to keep the Service available and useful, but we do not promise uninterrupted, error-free, or permanently available operation.

The Service may be unavailable because of maintenance, updates, provider outages, security incidents, technical failures, or circumstances outside our reasonable control.

We may add, change, restrict, or remove features. Where reasonably possible, we will avoid materially reducing paid Powerpack functionality during an active paid period.

We may discontinue the free Service or individual free features. If we permanently discontinue Powerpack during an active paid period, the proportional-refund rule in Section 5 applies.

We may release updates, including security updates, automatically.

## 11. Suspension and termination

You may stop using the Service or delete your account at any time.

We may suspend or terminate access immediately where reasonably necessary to:

- prevent serious abuse or illegal activity;
- protect users, infrastructure, or third parties;
- respond to a security threat;
- prevent fraud or misuse; or
- comply with a legal obligation.

For less serious issues, we will provide notice and a reasonable opportunity to correct the issue where reasonably possible.

Termination or account deletion may result in deletion of your content as described in the Privacy Policy. You should export anything you wish to keep before deleting your account.

Sections that by their nature should continue after termination—including ownership, disclaimers, liability limitations, governing law, and dispute provisions—remain effective.

## 12. Third-party services and links

The Service may use or link to third-party services, websites, job postings, authentication providers, payment providers, and data providers.

We do not control third-party websites or services and are not responsible for their content, availability, security, terms, or privacy practices.

A link or integration does not mean that we endorse the third party or guarantee its information.

## 13. Consumer rights and conformity

Nothing in these Terms removes rights that cannot legally be removed.

Where mandatory consumer law applies, you may have rights if a paid digital service is not supplied, does not match its description, or does not function as consumers may reasonably expect. Depending on the circumstances, those rights may include correction of the problem, a price reduction, termination, or a refund.

Any disclaimer, exclusion, or limitation in these Terms applies only to the extent permitted by law.

## 14. Disclaimers

Subject to Section 13, the Service is provided on an **"as available"** basis.

To the maximum extent permitted by law, we do not make additional warranties or guarantees about:

- availability, uptime, speed, or compatibility;
- uninterrupted or error-free operation;
- preservation of data without loss;
- the accuracy of user-entered, imported, extracted, generated, salary, or company information;
- results obtained from using the Service; or
- suitability for a particular job search, application, negotiation, or employment decision.

You remain responsible for your applications, communications, decisions, deadlines, backups, and use of information obtained through the Service.

## 15. Limitation of liability

To the maximum extent permitted by law, Petr Nagy is not liable for:

- lost employment, interviews, offers, opportunities, income, profits, or savings;
- decisions made by employers, recruiters, job platforms, or other third parties;
- reliance on AI-generated, extracted, salary, company, or other informational results;
- indirect, incidental, special, consequential, or purely economic loss;
- loss or corruption of data where you did not keep a reasonable backup or export;
- third-party services, websites, job postings, providers, or integrations;
- outages, delays, security events, or failures outside reasonable control; or
- misuse of the Service or violation of these Terms by a user.

Nothing in these Terms excludes or limits liability where doing so would be unlawful, including liability arising from fraud, intentional misconduct, or any mandatory consumer remedy that cannot be excluded.

## 16. Privacy

Our processing of personal data is described in the shortlistOS Privacy Policy, available through the Service.

## 17. Changes to these Terms

We may update these Terms when the Service, its pricing, legal requirements, or business practices change.

Material changes will be announced through a notice on the shortlistOS website or inside the Service. The effective date at the top will be updated.

Changes will not retroactively remove rights you already acquired during an active Powerpack period. Where the law requires your consent to a change, we will request it.

## 18. Governing law and disputes

These Terms are governed by the laws of the Czech Republic.

If you are a consumer, this choice does not deprive you of mandatory protections provided by the laws of your country of residence. Nothing in these Terms forces a consumer to bring a claim exclusively before Czech courts where applicable law allows another court.

Please contact us first so that we can try to resolve a complaint directly.

Consumers may also seek out-of-court resolution through the:

**Czech Trade Inspection Authority**

(Česká obchodní inspekce)

ADR information and submission details: https://coi.gov.cz/en/information-about-adr/

The Czech Trade Inspection Authority facilitates an amicable resolution but does not issue a binding court judgment.

The former EU Online Dispute Resolution platform is no longer available.

## 19. Severability and waiver

If part of these Terms is found invalid or unenforceable, the remaining parts continue to apply to the extent legally possible.

A delay or failure to enforce a provision does not permanently waive the right to enforce it later.

## 20. Contact

Questions, complaints, withdrawal notices, or legal notices may be sent to:

- **Petr Nagy**
- Mariánské nám. 5
- 110 00 Staré Město
- Prague, Czechia
- IČO: 88074625
- Email: privacy@shortlistos.co

## Model withdrawal form

Complete and send this form only if you wish to withdraw from a Powerpack purchase. A normal email or other clear statement is also sufficient.

> To: Petr Nagy, Mariánské nám. 5, 110 00 Staré Město, Prague, Czechia
>
> Email: privacy@shortlistos.co
>
> I hereby give notice that I withdraw from my contract for the purchase of Powerpack.
>
> - Purchase date:
> - Account email address:
> - Name:
> - Date:
> - Signature (only if submitted on paper):
`;

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

  return (
    text.includes("Mariánské nám. 5") &&
    text.includes("Email: privacy@shortlistos.co")
  );
}

export default function TermsView() {
  return (
    <Layout>
      <PageHead title="Terms of Use | shortlistOS" />
      <div className="mb-20">
        <section className="scroll-mt-20 px-4 pb-14 pt-28">
          <div className="mx-auto max-w-[980px]">
            <div className="mx-auto max-w-[680px] text-center">
              <h1 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
                Terms of Use
              </h1>
              <p className="mt-4 text-base leading-[1.95rem] text-light-950 dark:text-dark-900">
                Effective date: 6 July 2026
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
                {termsOfUseMarkdown}
              </ReactMarkdown>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
