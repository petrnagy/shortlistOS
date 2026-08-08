import { render } from "@react-email/render";
import nodemailer from "nodemailer";

import { createLogger } from "@kan/logger";

import AppliedFollowUpTemplate from "./templates/applied-follow-up";
import FeedbackNotificationTemplate from "./templates/feedback-notification";
import InterviewingNudgeTemplate from "./templates/interviewing-nudge";
import JoinWorkspaceTemplate from "./templates/join-workspace";
import MagicLinkTemplate from "./templates/magic-link";
import MentionTemplate from "./templates/mention";
import NegotiatingNudgeTemplate from "./templates/negotiating-nudge";
import ResetPasswordTemplate from "./templates/reset-password";
import SavedReminderTemplate from "./templates/saved-reminder";
import WeeklyDigestTemplate from "./templates/weekly-digest";
import WelcomeTemplate from "./templates/welcome";

const log = createLogger("email");

type Templates =
  | "MAGIC_LINK"
  | "JOIN_WORKSPACE"
  | "RESET_PASSWORD"
  | "MENTION"
  | "FEEDBACK_NOTIFICATION"
  | "WELCOME"
  | "SHORTLIST_SAVED_REMINDER"
  | "SHORTLIST_APPLIED_FOLLOW_UP"
  | "SHORTLIST_INTERVIEWING_NUDGE"
  | "SHORTLIST_NEGOTIATING_NUDGE"
  | "SHORTLIST_WEEKLY_DIGEST";

const emailTemplates: Record<Templates, React.ElementType> = {
  MAGIC_LINK: MagicLinkTemplate,
  JOIN_WORKSPACE: JoinWorkspaceTemplate,
  RESET_PASSWORD: ResetPasswordTemplate,
  MENTION: MentionTemplate,
  FEEDBACK_NOTIFICATION: FeedbackNotificationTemplate,
  WELCOME: WelcomeTemplate,
  SHORTLIST_SAVED_REMINDER: SavedReminderTemplate,
  SHORTLIST_APPLIED_FOLLOW_UP: AppliedFollowUpTemplate,
  SHORTLIST_INTERVIEWING_NUDGE: InterviewingNudgeTemplate,
  SHORTLIST_NEGOTIATING_NUDGE: NegotiatingNudgeTemplate,
  SHORTLIST_WEEKLY_DIGEST: WeeklyDigestTemplate,
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure:
    process.env.SMTP_SECURE === undefined
      ? true
      : process.env.SMTP_SECURE.toLowerCase() === "true",
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized:
      process.env.SMTP_REJECT_UNAUTHORIZED === undefined
        ? true
        : process.env.SMTP_REJECT_UNAUTHORIZED.toLowerCase() === "true",
  },
  ...(process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD && {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    }),
});

export const sendEmail = async (
  to: string,
  subject: string,
  template: Templates,
  data: Record<string, string>,
) => {
  log.info({ to, subject, template }, "Sending email");
  try {
    const EmailTemplate = emailTemplates[template];

    const html = await render(<EmailTemplate {...data} />, { pretty: true });

    const options = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    };

    const response = await transporter.sendMail(options);

    if (!response.accepted.length) {
      throw new Error(`Failed to send email: ${response.response}`);
    }

    log.info(
      { to, subject, template, messageId: response.messageId },
      "Email sent",
    );
    return response;
  } catch (error) {
    log.error(
      { err: error, to, from: process.env.EMAIL_FROM, subject, template },
      "Email sending failed",
    );
    throw error;
  }
};
