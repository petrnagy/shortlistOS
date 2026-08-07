import { describe, expect, it } from "vitest";

import {
  escapeIcalText,
  formatIcalDate,
  renderShortlistCalendar,
} from "./shortlistCalendar";

describe("shortlist iCalendar rendering", () => {
  it("renders importable UTC events with stable UIDs", () => {
    const result = renderShortlistCalendar({
      boardName: "My shortlist",
      boardUrl: "https://app.shortlistos.co/boards/board1234567",
      events: [
        {
          cardPublicId: "card12345678",
          title: "Engineer",
          company: "Example, Inc.",
          startsAt: new Date("2026-08-10T09:30:00.000Z"),
          updatedAt: new Date("2026-08-04T12:00:00.000Z"),
        },
      ],
    });

    expect(result).toContain("BEGIN:VCALENDAR\r\n");
    expect(result).toContain("UID:card12345678@shortlistos");
    expect(result).toContain("DTSTART:20260810T093000Z");
    expect(result).toContain("SUMMARY:Interview: Engineer at Example\\, Inc.");
    expect(result).toMatch(/END:VCALENDAR\r\n$/);
  });

  it("escapes iCalendar text and formats UTC timestamps", () => {
    expect(escapeIcalText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(formatIcalDate(new Date("2026-08-04T07:00:00.000Z"))).toBe(
      "20260804T070000Z",
    );
  });
});
