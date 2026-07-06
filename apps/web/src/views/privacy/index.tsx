import type { ReactNode } from "react";
import { isValidElement } from "react";
import ReactMarkdown from "react-markdown";

import { PageHead } from "~/components/PageHead";
import Layout from "../home/components/Layout";

const privacyPolicyMarkdown = `
This Privacy Policy explains how the **Service** handles personal data.

## 1. Who operates the Service?

For the purposes of this Privacy Policy, the **Service** means the shortlistOS website, hosted application, Powerpack features, Magic Inbox, Web Clipper, APIs, and related service subdomains.

The Service is operated by:

- **Petr Nagy**
- Mariánské nám. 5
- 110 00 Staré Město
- Prague, Czechia
- Business ID: 88074625
- Website: petrnagy.cz
- Privacy contact: privacy@shortlistos.co

Petr Nagy is the data controller for the Service.

No data protection officer has been appointed. Privacy requests are handled directly by Petr Nagy.

## 2. What this policy covers

This policy covers the Service as defined above.

This policy does **not** cover independently self-hosted versions of shortlistOS. The operators of those instances are responsible for their own data processing.

## 3. Data we collect

### Account and authentication data

To create and use an account, we may process:

- your email address;
- an optional display name;
- an optional avatar;
- a securely hashed password, when you use password authentication;
- authentication and session information; and
- a provider account ID and basic profile data when you sign in through Google, Microsoft, GitHub, or LinkedIn.

Your display name and avatar do not need to represent your real identity.

OAuth providers are used only for authentication. shortlistOS does not send your job-search content back to them.

### Content you add to shortlistOS

You may add information such as:

- job opportunities and job descriptions;
- company information;
- recruiter or other contact details;
- notes and comments;
- salary information and offer terms;
- interview dates and reminders;
- files, documents, and images;
- job-posting URLs;
- activity history; and
- emails sent through Magic Inbox.

This content is private to your account and is not visible to other shortlistOS users. Access by the operator and service providers is limited to what is needed to run, secure, support, or troubleshoot the service.

Users should only add information they are entitled to use and should avoid uploading unnecessary sensitive or confidential information.

### Magic Inbox data

When you intentionally send or forward an email to your private Magic Inbox address, shortlistOS temporarily processes:

- the email headers;
- the email body;
- supported attachments; and
- text extracted from supported office documents, such as PDF, DOC, and DOCX files.

The raw email and attachments are kept only while the message is being processed. They are normally deleted within minutes.

If processing fails, shortlistOS retries it up to three times. The raw input is deleted after the third failed attempt. In unusual cases, this may take longer than 24 hours.

After successful processing, the raw input is deleted and only the resulting information added to the relevant opportunity is kept.

### Web Clipper data

The Web Clipper sends data only when you actively choose to clip a page. It may send:

- the full rendered HTML of the page; and
- the page URL.

The raw HTML is deleted after processing. Only the resulting information added to shortlistOS is retained.

The Web Clipper does not collect or transmit pages in the background.

### AI and automation data

Powerpack automation and AI features may add or update information on a job-opportunity card. You can review, edit, or delete those changes.

These features do not make hiring decisions, determine eligibility, reject candidates, or make other decisions with legal or similarly significant effects.

For AI processing, relevant content may be sent to Mistral AI, including:

- clipped-page HTML;
- forwarded email content;
- text extracted from supported documents; and
- job-related information contained in that content.

shortlistOS does not use your content to train its own AI models. Mistral's retention and model-improvement practices are governed by the Mistral plan, privacy settings, and terms that apply when processing takes place.

Deleting raw input from shortlistOS does not necessarily mean that any copy processed by Mistral is deleted at the same time. Mistral handles its copy according to its own terms and configured data controls.

### Salary and company information

shortlistOS uses OpenWebNinja to retrieve salary or company-related information.

Only the following information is sent to OpenWebNinja:

- job title; and
- company name.

No account details, email addresses, notes, comments, attachments, Magic Inbox messages, or other user content are sent to OpenWebNinja.

### Payment data

Powerpack payments are processed by Stripe.

shortlistOS stores only:

- your Stripe customer ID; and
- your Powerpack expiry date.

shortlistOS does not receive or store card numbers or other full card details. Stripe processes and retains payment information under its own terms.

### Communications

Brevo is used to send transactional and service-related emails, such as:

- sign-in and verification messages;
- password-reset messages;
- reminders;
- service notices; and
- Powerpack-related messages.

Brevo receives the recipient's email address and the content of the email being sent.

shortlistOS does not send marketing or promotional emails.

Emails sent to addresses ending in \`@shortlistos.co\`, including privacy and support emails, are handled through Google Workspace, which is managed only by Petr Nagy.

Support and privacy-request emails are archived and remain available until the sender asks for their deletion, unless keeping them is required to establish, exercise, or defend a legal claim or to comply with the law.

### Technical and security data

The shortlistOS web server logs:

- IP address;
- requested URL;
- user-agent information; and
- API requests, which appear as normal web-server requests.

Web-server logs are retained for 15 days.

Error logs may contain technical information related to an application error. They are retained until the next application release.

Cloudflare may process network and device information when providing:

- DNS;
- caching and content delivery;
- DDoS protection;
- security filtering; and
- Cloudflare Turnstile challenges when needed.

UptimeRobot checks only public paths to confirm that the service is available. It does not monitor private user pages or user-specific API endpoints.

## 4. Analytics, cookies, and local storage

### Session cookie

shortlistOS uses one essential session cookie to keep you signed in and secure your session.

It is not used for advertising or behavioral tracking.

### Local storage

Browser local storage may be used to remember preferences such as your selected language.

### Simple Analytics

Simple Analytics is used on the public website, subpages, and inside the application.

shortlistOS uses the official Simple Analytics Next.js library without custom events. Simple Analytics provides aggregate website statistics and does not use cookies, retain IP addresses, or create user or device identifiers.

## 5. Why we process data

We process personal data for the following purposes and legal bases:

| Purpose | Legal basis |
|---|---|
| Creating and operating your account | Performing our contract with you |
| Storing and managing your job-search information | Performing our contract with you |
| Processing Magic Inbox, Web Clipper, AI, and automation requests | Performing our contract with you |
| Processing Powerpack purchases and access | Performing our contract with you |
| Sending transactional and service messages | Performing our contract with you |
| Responding to support and privacy requests | Performing our contract, our legitimate interests, or compliance with legal obligations |
| Preventing abuse and protecting the service | Our legitimate interests in security and fraud prevention |
| Keeping short-lived server and error logs | Our legitimate interests in security, maintenance, and troubleshooting |
| Measuring aggregate usage through Simple Analytics | Our legitimate interest in understanding and improving the service |
| Complying with binding legal requests | Compliance with a legal obligation |

Where processing is based on legitimate interests, we use data only where those interests are not overridden by your rights and freedoms.

## 6. Service providers

We use the following service providers:

| Provider | Purpose | Data involved |
|---|---|---|
| Hetzner | Application and PostgreSQL hosting, VPS backups | Account data, user content, technical data |
| Amazon Web Services | Private avatar and attachment storage | Avatars, files, and attachments |
| Mistral AI | AI extraction and processing | Content submitted for AI processing |
| OpenWebNinja | Salary and company information | Job title and company name only |
| Brevo | Transactional email and Magic Inbox email routing | Recipient, email content, incoming Magic Inbox messages |
| Stripe | Payment processing | Payment and billing information |
| Simple Analytics | Aggregate usage analytics | Privacy-preserving aggregate visit data |
| Cloudflare | DNS, CDN, caching, security, DDoS protection, Turnstile | Network, request, device, and challenge data |
| UptimeRobot | Public uptime monitoring | Requests to public paths |
| Google Workspace | Receiving support and privacy emails | Sender, recipient, and email content |
| Google, Microsoft, GitHub, and LinkedIn | Optional account authentication | Basic profile and authentication data |

We may also disclose data where required by law, a binding court order, or a valid request from a competent authority.

We do not sell or rent personal data. We do not share it for advertising or behavioral profiling.

## 7. Where data is stored

The live shortlistOS application and PostgreSQL database are hosted on a Hetzner server in Germany.

Avatars and attachments are stored privately in the AWS \`eu-north-1\` region in Stockholm, Sweden. They are available only through authorized links.

Hetzner keeps VPS backups according to the backup settings and retention available for the service. Deleted data may therefore remain in backups until those backups expire.

Our own core hosting and file storage are located in the European Union. Some external providers are global companies and may process limited data outside the European Economic Area under their own terms and legally recognized transfer safeguards.

## 8. How long we keep data

We keep account data and user content until you delete the relevant content or delete your account.

When you delete your account:

- live database records are deleted;
- AWS-hosted avatars, files, and attachments are deleted; and
- remaining backup copies disappear when the applicable backups expire.

Other retention periods include:

- web-server logs: 15 days;
- error logs: until the next application release;
- raw Magic Inbox and Web Clipper input: normally minutes, or until successful processing or the third failed attempt;
- support and privacy emails: until deletion is requested, subject to any necessary legal retention; and
- Stripe payment records: retained by Stripe according to Stripe's own requirements and policies.

Browser preferences remain in local storage until you clear them or shortlistOS replaces or removes them.

## 9. Your controls and rights

Inside the application, you can:

- view and correct your account information;
- edit or delete individual opportunities and other content;
- export your shortlistOS data in JSON format; and
- delete your account and its live data.

Depending on the law that applies to you, you may also have the right to:

- access your personal data;
- correct inaccurate or incomplete data;
- request deletion;
- restrict processing;
- object to certain processing;
- receive portable data; and
- complain to a data-protection authority.

To exercise a right that cannot be completed directly in the app, contact **privacy@shortlistos.co**.

We may ask you to reasonably verify your identity before disclosing or deleting data. A logged-in user can delete their own account directly without making a separate email request.

In Czechia, the relevant supervisory authority is the **Office for Personal Data Protection**.

## 10. Security

We use reasonable technical and organizational measures to protect personal data, including:

- HTTPS encryption for traffic;
- a database that is not publicly accessible;
- hashed passwords;
- private file storage;
- authorized links for files and avatars;
- restricted infrastructure access;
- security filtering and DDoS protection; and
- limited log-retention periods.

Production systems and data are accessible only to Petr Nagy and relevant service providers where access is needed to provide or support their services.

No online service can guarantee absolute security.

## 11. Age requirement

shortlistOS is intended for people aged 16 or older.

The service does not contain adult content, but users must be old enough to create an account and make a payment where applicable.

## 12. Changes to this policy

We may update this Privacy Policy when shortlistOS, its service providers, or legal requirements change.

Material changes will be announced through an updated notice on the shortlistOS website. The effective date at the top of this policy will also be updated.

## 13. Contact

For questions, requests, or complaints about privacy, contact:

- **Petr Nagy**
- Email: privacy@shortlistos.co
- Address: Mariánské nám. 5, 110 00 Staré Město, Prague, Czechia
- Business ID: 88074625
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
    text.includes("Privacy contact: privacy@shortlistos.co")
  );
}

export default function PrivacyView() {
  return (
    <Layout>
      <PageHead title="Privacy Policy | shortlistOS" />
      <div className="mb-20">
        <section className="scroll-mt-20 px-4 pb-14 pt-28">
          <div className="mx-auto max-w-[980px]">
            <div className="mx-auto max-w-[680px] text-center">
              <h1 className="mt-3 text-3xl font-bold leading-[1.35] text-light-1000 dark:text-dark-1000 md:text-4xl">
                Privacy Policy
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
                  h3: ({ children }) => (
                    <h3 className="mb-3 mt-7 text-xl font-bold text-light-1000 dark:text-dark-950">
                      {children}
                    </h3>
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
                  table: ({ children }) => (
                    <div className="mb-6 overflow-x-auto rounded-md border border-light-300 dark:border-dark-300">
                      <table className="min-w-full divide-y divide-light-300 text-left text-sm dark:divide-dark-300">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-light-200 dark:bg-dark-200">
                      {children}
                    </thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-3 font-bold text-light-1000 dark:text-dark-1000">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-t border-light-300 px-4 py-3 leading-[1.6rem] text-light-1000 dark:border-dark-300 dark:text-dark-900">
                      {children}
                    </td>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-light-200 px-1 py-0.5 text-sm dark:bg-dark-200">
                      {children}
                    </code>
                  ),
                }}
              >
                {privacyPolicyMarkdown}
              </ReactMarkdown>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
