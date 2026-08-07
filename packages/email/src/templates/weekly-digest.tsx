import * as React from "react";

import { AutomationEmailFrame } from "./automation-frame";

export default function WeeklyDigestTemplate(props: {
  boardName: string;
  summary: string;
  actionUrl: string;
}) {
  return (
    <AutomationEmailFrame
      preview={`Your weekly ${props.boardName} digest`}
      heading="Your weekly shortlist digest"
      body={props.summary}
      boardName={props.boardName}
      actionUrl={props.actionUrl}
    />
  );
}
