import * as React from "react";

import { AutomationEmailFrame } from "./automation-frame";

export default function InterviewingNudgeTemplate(props: {
  boardName: string;
  cardTitle: string;
  actionUrl: string;
}) {
  return (
    <AutomationEmailFrame
      preview={`Check in on ${props.cardTitle}`}
      heading="Keep the interview process moving"
      body={`${props.cardTitle} has had no recent activity while Interviewing. Consider checking in with the recruiter or recording the next interview date.`}
      boardName={props.boardName}
      actionUrl={props.actionUrl}
      actionLabel="Review interview"
    />
  );
}
