import { t } from "@lingui/core/macro";
import {
  HiOutlineBars3BottomLeft,
  HiOutlineChatBubbleLeft,
  HiOutlineClock,
  HiOutlineEllipsisHorizontal,
  HiOutlinePaperClip,
  HiOutlinePlus,
  HiOutlineSquares2X2,
} from "react-icons/hi2";

interface PreviewLabel {
  colour: string;
  name: string;
}

interface PreviewCard {
  title: string;
  labels?: PreviewLabel[];
  date?: string;
  comments?: boolean;
  attachment?: boolean;
  aged?: boolean;
}

interface PreviewColumn {
  title: string;
  cards: PreviewCard[];
}

const labelColours = {
  blue: "#0284c7",
  green: "#0d9488",
  pink: "#db2777",
  red: "#dc2626",
  yellow: "#ca8a04",
} as const;

function PreviewLabelPill({ label }: { label: PreviewLabel }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium text-light-800 ring-1 ring-inset ring-light-400 dark:text-dark-900 dark:ring-dark-500">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: label.colour }}
      />
      {label.name}
    </span>
  );
}

function PreviewCard({ card }: { card: PreviewCard }) {
  return (
    <div
      className={`rounded-md border border-light-200 px-3 py-2 text-xs text-light-1000 shadow-sm dark:border-dark-200 dark:text-dark-1000 ${
        card.aged
          ? "bg-amber-50/70 dark:bg-amber-950/20"
          : "bg-light-50 dark:bg-dark-200"
      }`}
    >
      <p className="min-h-8 leading-4">{card.title}</p>
      {card.labels?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <PreviewLabelPill key={label.name} label={label} />
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex min-h-4 items-center justify-between gap-2 text-light-700 dark:text-dark-700">
        <div className="flex items-center gap-2">
          <HiOutlineBars3BottomLeft className="h-3.5 w-3.5" />
          {card.date ? (
            <span className="flex items-center gap-1 text-[10px]">
              <HiOutlineClock className="h-3.5 w-3.5" />
              {card.date}
            </span>
          ) : null}
          {card.comments ? (
            <HiOutlineChatBubbleLeft className="h-3.5 w-3.5" />
          ) : null}
          {card.attachment ? (
            <HiOutlinePaperClip className="h-3.5 w-3.5" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PreviewColumn({ column }: { column: PreviewColumn }) {
  return (
    <div className="h-fit w-[250px] shrink-0 rounded-md border border-light-400 bg-light-300 p-2 dark:border-dark-300 dark:bg-dark-100">
      <div className="mb-2 flex items-center justify-between px-3 pt-1">
        <h3 className="text-xs font-semibold text-light-1000 dark:text-dark-1000">
          {column.title}
        </h3>
        <HiOutlinePlus className="h-4 w-4 text-light-800 dark:text-dark-800" />
      </div>
      <div className="space-y-2">
        {column.cards.map((card) => (
          <PreviewCard key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}

export default function BoardPreview() {
  const columns: PreviewColumn[] = [
    {
      title: t`Saved`,
      cards: [
        {
          title: t`Senior PHP Developer at Amber Cloud`,
          labels: [
            { colour: labelColours.green, name: t`Above market salary` },
          ],
        },
        {
          title: t`Python Engineer at BrightRail`,
          labels: [{ colour: labelColours.red, name: t`On-site` }],
          comments: true,
          attachment: true,
          aged: true,
        },
        {
          title: t`Senior Backend Engineer at Northstar Labs`,
          labels: [
            { colour: labelColours.yellow, name: t`High priority` },
            { colour: labelColours.green, name: t`Above market salary` },
          ],
          date: t`12th Aug`,
        },
        {
          title: t`Full-Stack Developer at Blue Oak Systems`,
          labels: [{ colour: labelColours.yellow, name: t`Hybrid` }],
          attachment: true,
        },
        {
          title: t`Backend PHP Engineer at Bohemian Logic`,
          labels: [{ colour: labelColours.red, name: t`Referral` }],
          comments: true,
        },
        {
          title: t`API Developer at PixelHarbor`,
          labels: [{ colour: labelColours.blue, name: t`Equity` }],
          date: t`25th Aug`,
        },
      ],
    },
    {
      title: t`Applied`,
      cards: [
        {
          title: t`Lead Platform Engineer at Mosaic Systems`,
          labels: [{ colour: labelColours.yellow, name: t`Hybrid` }],
          date: t`31st Aug`,
          comments: true,
          attachment: true,
          aged: true,
        },
        {
          title: t`Full-Stack Developer at Creative Heroes`,
          labels: [{ colour: labelColours.red, name: t`On-site` }],
          comments: true,
        },
        {
          title: t`Backend Architect at CopperFox`,
          labels: [
            { colour: labelColours.yellow, name: t`High priority` },
            { colour: labelColours.green, name: t`Above market salary` },
          ],
        },
        {
          title: t`Senior Full-Stack Engineer at BrightRail`,
          labels: [
            { colour: labelColours.green, name: t`Application confirmed` },
          ],
          date: t`14th Aug`,
          comments: true,
        },
        {
          title: t`PHP Software Engineer at Amber Cloud`,
          labels: [{ colour: labelColours.yellow, name: t`High priority` }],
          attachment: true,
        },
        {
          title: t`Backend Developer at Kiteworks`,
          labels: [{ colour: labelColours.green, name: t`Dream job` }],
          comments: true,
        },
      ],
    },
    {
      title: t`In contact`,
      cards: [
        {
          title: t`Lead Software Engineer at Riverbyte`,
          labels: [
            { colour: labelColours.yellow, name: t`High priority` },
            { colour: labelColours.red, name: t`Referral` },
          ],
          comments: true,
        },
        {
          title: t`PHP Software Engineer at OpenField`,
          labels: [
            { colour: labelColours.green, name: t`Above market salary` },
          ],
          date: t`11th Aug`,
        },
        {
          title: t`Backend Architect at Vertex Works`,
          labels: [{ colour: labelColours.pink, name: t`Red flag` }],
          comments: true,
        },
        {
          title: t`Full-Stack Engineer at Nimbus Commerce`,
          labels: [{ colour: labelColours.yellow, name: t`High priority` }],
          date: t`18th Aug`,
        },
        {
          title: t`Senior PHP Developer at Morava Digital`,
          labels: [{ colour: labelColours.red, name: t`Referral` }],
          comments: true,
        },
      ],
    },
    {
      title: t`Interviewing`,
      cards: [
        {
          title: t`Senior PHP Developer at Atlas Foundry`,
          labels: [
            { colour: labelColours.green, name: t`Dream job` },
            { colour: labelColours.blue, name: t`Equity` },
            { colour: labelColours.yellow, name: t`High priority` },
          ],
          date: t`19th Aug`,
          comments: true,
        },
        {
          title: t`Laravel Developer at Cloudsmith Europe`,
          labels: [{ colour: labelColours.blue, name: t`Equity` }],
          comments: true,
        },
        {
          title: t`Platform Engineer at Northstar Labs`,
          labels: [{ colour: labelColours.green, name: t`Dream job` }],
        },
      ],
    },
    {
      title: t`Negotiating`,
      cards: [
        {
          title: t`Senior Backend Engineer at Cobalt Labs`,
          labels: [
            { colour: labelColours.yellow, name: t`High priority` },
            { colour: labelColours.blue, name: t`Equity` },
          ],
          date: t`22nd Aug`,
          comments: true,
        },
        {
          title: t`Platform Engineer at Danube Software`,
          labels: [
            { colour: labelColours.green, name: t`Above market salary` },
          ],
          attachment: true,
        },
      ],
    },
    {
      title: t`Accepted`,
      cards: [
        {
          title: t`Full-Stack Engineer at NovaGrid`,
          labels: [{ colour: labelColours.green, name: t`Dream job` }],
          comments: true,
          attachment: true,
        },
        {
          title: t`Senior PHP Developer at LimePeak`,
          labels: [
            { colour: labelColours.green, name: t`Above market salary` },
          ],
        },
      ],
    },
    {
      title: t`Rejected`,
      cards: [
        {
          title: t`Backend Developer at OrbitStack`,
          comments: true,
        },
        {
          title: t`Software Engineer at Silverline Tech`,
          labels: [{ colour: labelColours.red, name: t`On-site` }],
          aged: true,
        },
      ],
    },
    {
      title: t`Withdrawn`,
      cards: [
        {
          title: t`PHP Developer at Pinecone Digital`,
          labels: [{ colour: labelColours.pink, name: t`Red flag` }],
          comments: true,
        },
        {
          title: t`API Developer at Crafted Systems`,
          attachment: true,
        },
      ],
    },
  ];

  return (
    <div className="relative h-[600px] overflow-hidden bg-light-100 dark:bg-dark-50">
      <div className="absolute inset-y-0 left-0 hidden w-[170px] border-r border-light-300 bg-light-50 p-4 dark:border-dark-300 dark:bg-dark-100 sm:block">
        <p className="text-sm font-bold text-light-1000 dark:text-dark-1000">
          shortlistOS
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-light-1000 dark:text-dark-1000">
          <span className="bg-brand-600 flex h-6 w-6 items-center justify-center rounded-md text-white">
            P
          </span>
          {t`My workspace`}
        </div>
        <nav className="mt-7 space-y-2 text-xs text-light-900 dark:text-dark-900">
          <div className="flex items-center gap-2 rounded-md bg-light-200 px-2 py-2 dark:bg-dark-200">
            <HiOutlineSquares2X2 className="h-4 w-4" />
            {t`Shortlists`}
          </div>
          <p className="px-8 py-1 font-medium text-light-1000 dark:text-dark-1000">{t`Job hunt 2026`}</p>
          <p className="px-8 py-1">{t`Frontend roles`}</p>
          <p className="px-8 py-1">{t`Remote opportunities`}</p>
        </nav>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs text-light-900 dark:text-dark-900">
          <span className="h-6 w-6 rounded-full bg-emerald-700" />
          {t`You`}
        </div>
      </div>

      <div className="h-full sm:ml-[170px]">
        <div className="flex h-[72px] items-center justify-between border-b border-light-300 bg-light-50 px-6 dark:border-dark-300 dark:bg-dark-100">
          <h2 className="text-base font-bold text-light-1000 dark:text-dark-1000">{t`Job hunt 2026`}</h2>
          <HiOutlineEllipsisHorizontal className="h-5 w-5 text-light-800 dark:text-dark-800" />
        </div>
        <div className="h-[528px] overflow-auto">
          <div className="flex min-h-full w-max gap-4 p-5">
            {columns.map((column) => (
              <PreviewColumn key={column.title} column={column} />
            ))}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-light-100 to-transparent dark:from-dark-50" />
    </div>
  );
}
