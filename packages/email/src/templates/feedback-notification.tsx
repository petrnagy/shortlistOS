import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Link } from "@react-email/link";
import { Preview } from "@react-email/preview";
import { Text } from "@react-email/text";
import { env } from "next-runtime-env";
import * as React from "react";

export const FeedbackNotificationTemplate = ({
  feedback,
  feedbackUrl,
  userEmail,
  userName,
}: {
  feedback: string;
  feedbackUrl: string;
  userEmail: string;
  userName: string;
}) => (
  <Html>
    <Head />
    <Preview>New shortlistOS feedback from {userEmail}</Preview>
    <Body style={{ backgroundColor: "white" }}>
      <Container
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          margin: "auto",
          paddingLeft: "0.75rem",
          paddingRight: "0.75rem",
        }}
      >
        <Heading
          style={{
            marginTop: "2.5rem",
            marginBottom: "2.5rem",
            fontSize: "24px",
            fontWeight: "bold",
            color: "#232323",
          }}
        >
          shortlistOS
        </Heading>
        <Heading
          style={{ fontSize: "24px", fontWeight: "bold", color: "#232323" }}
        >
          New feedback
        </Heading>
        <Text style={{ fontSize: "0.875rem", color: "#232323" }}>
          <strong>From:</strong> {userName ? `${userName} ` : ""}
          {userEmail}
        </Text>
        <Text style={{ fontSize: "0.875rem", color: "#232323" }}>
          <strong>Page:</strong>{" "}
          <Link
            href={feedbackUrl}
            target="_blank"
            style={{ color: "#2563eb", textDecoration: "underline" }}
          >
            {feedbackUrl}
          </Link>
        </Text>
        <Hr
          style={{
            marginTop: "2rem",
            marginBottom: "2rem",
            borderWidth: "1px",
          }}
        />
        <Text
          style={{
            fontSize: "0.875rem",
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
            color: "#232323",
          }}
        >
          {feedback}
        </Text>
        <Hr
          style={{
            marginTop: "2.5rem",
            marginBottom: "2rem",
            borderWidth: "1px",
          }}
        />
        <Text style={{ color: "#7e7e7e" }}>
          Sent from{" "}
          <Link
            href={env("NEXT_PUBLIC_BASE_URL")}
            target="_blank"
            style={{ color: "#7e7e7e", textDecoration: "underline" }}
          >
            shortlistOS
          </Link>
          .
        </Text>
      </Container>
    </Body>
  </Html>
);

export default FeedbackNotificationTemplate;
