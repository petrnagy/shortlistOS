import * as React from "react";

import { AutomationEmailFrame } from "./automation-frame";

export default function AppliedFollowUpTemplate(props: {
  boardName: string;
  cardTitle: string;
  actionUrl: string;
}) {
  return (
    <AutomationEmailFrame
      preview={`It may be time to follow up on ${props.cardTitle}`}
      heading="Time to follow up"
      body={`${props.cardTitle} has been in Applied without recent activity. A short, polite follow-up could keep the conversation moving.`}
      boardName={props.boardName}
      actionUrl={props.actionUrl}
      actionLabel="Open opportunity"
    />
  );
}
