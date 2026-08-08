import { Text } from "@react-email/components";
import * as React from "react";

import { getBaseUrl } from "../utils/get-base-url";
import { BrandedEmailFrame } from "./branded-email-frame";

export default function WelcomeTemplate({ name }: { name?: string }) {
  const greeting = name?.trim() ? `Welcome, ${name.trim()}!` : "Welcome!";

  return (
    <BrandedEmailFrame
      preview="Welcome to shortlistOS"
      heading={greeting}
      actionUrl={`${getBaseUrl().replace(/\/$/, "")}/get-started`}
      actionLabel="Get started"
      footer="You received this email because you created a shortlistOS account."
    >
      <Text style={{ fontSize: "15px", lineHeight: "24px" }}>
        shortlistOS gives you one private place to organize opportunities and
        keep your job search moving.
      </Text>
      <Text style={{ fontSize: "15px", lineHeight: "24px" }}>
        Start with the short guide, then create your first shortlist when
        you&apos;re ready.
      </Text>
    </BrandedEmailFrame>
  );
}
