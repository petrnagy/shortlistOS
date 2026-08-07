import * as React from "react";

import { AutomationEmailFrame } from "./automation-frame";

export default function NegotiatingNudgeTemplate(props: {
  boardName: string;
  cardTitle: string;
  actionUrl: string;
}) {
  return (
    <AutomationEmailFrame
      preview={`Revisit the negotiation for ${props.cardTitle}`}
      heading="A negotiation needs attention"
      body={`${props.cardTitle} has been quiet while Negotiating. Review the offer, outstanding questions, and your next follow-up.`}
      boardName={props.boardName}
      actionUrl={props.actionUrl}
      actionLabel="Review negotiation"
    />
  );
}
