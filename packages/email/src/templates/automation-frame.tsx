import { Text } from "@react-email/components";
import * as React from "react";

import { BrandedEmailFrame } from "./branded-email-frame";

export function AutomationEmailFrame({
  preview,
  heading,
  body,
  boardName,
  actionUrl,
  actionLabel = "Open shortlist",
}: {
  preview: string;
  heading: string;
  body: string;
  boardName: string;
  actionUrl: string;
  actionLabel?: string;
}) {
  return (
    <BrandedEmailFrame
      preview={preview}
      heading={heading}
      actionUrl={actionUrl}
      actionLabel={actionLabel}
      footer="You received this because this automation is enabled for your shortlist. Disable it in shortlist settings."
    >
      <Text style={{ fontSize: "15px", lineHeight: "24px" }}>{body}</Text>
      <Text style={{ color: "#666666", fontSize: "14px" }}>
        Shortlist: {boardName}
      </Text>
    </BrandedEmailFrame>
  );
}
