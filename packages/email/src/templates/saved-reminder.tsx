import * as React from "react";

import { AutomationEmailFrame } from "./automation-frame";

export default function SavedReminderTemplate(props: {
  boardName: string;
  cardTitle: string;
  actionUrl: string;
}) {
  return (
    <AutomationEmailFrame
      preview={`${props.cardTitle} is still waiting in Saved`}
      heading="An opportunity is waiting in Saved"
      body={`${props.cardTitle} has not moved recently. Review it and decide whether to apply, update it, or archive it.`}
      boardName={props.boardName}
      actionUrl={props.actionUrl}
      actionLabel="Review opportunity"
    />
  );
}
