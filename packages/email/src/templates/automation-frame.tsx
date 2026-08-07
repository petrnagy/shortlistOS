import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

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
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#ffffff", color: "#232323" }}>
        <Container
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            margin: "auto",
            maxWidth: "560px",
            padding: "24px 12px",
          }}
        >
          <Heading style={{ fontSize: "24px", marginBottom: "32px" }}>
            shortlistOS
          </Heading>
          <Heading style={{ fontSize: "22px" }}>{heading}</Heading>
          <Text style={{ fontSize: "15px", lineHeight: "24px" }}>{body}</Text>
          <Text style={{ color: "#666", fontSize: "14px" }}>
            Shortlist: {boardName}
          </Text>
          <Button
            href={actionUrl}
            style={{
              backgroundColor: "#282828",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "14px",
              fontWeight: "500",
              marginTop: "12px",
              padding: "14px 22px",
            }}
          >
            {actionLabel}
          </Button>
          <Hr style={{ margin: "32px 0 20px" }} />
          <Text style={{ color: "#777", fontSize: "12px" }}>
            You received this because this automation is enabled for your
            shortlist. Disable it in shortlist settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
