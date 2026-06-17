import type { KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  HiOutlineBanknotes,
  HiOutlineBars3BottomLeft,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentText,
  HiOutlineLink,
  HiOutlineLockClosed,
  HiOutlineMapPin,
  HiOutlinePencilSquare,
  HiOutlineShieldCheck,
  HiOutlineStar,
  HiOutlineTag,
  HiStar,
  HiXMark,
} from "react-icons/hi2";
import { IoChevronForwardSharp } from "react-icons/io5";
import { LuTreePalm } from "react-icons/lu";

import { authClient } from "@kan/auth/client";

import Avatar from "~/components/Avatar";
import Editor from "~/components/Editor";
import FeedbackModal from "~/components/FeedbackModal";
import { LabelForm } from "~/components/LabelForm";
import LabelIcon from "~/components/LabelIcon";
import Modal from "~/components/modal";
import { NewWorkspaceForm } from "~/components/NewWorkspaceForm";
import { PageHead } from "~/components/PageHead";
import Toggle from "~/components/Toggle";
import { EditYouTubeModal } from "~/components/YouTubeEmbed/EditYouTubeModal";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";
import { formatMemberDisplayName, getAvatarUrl } from "~/utils/helpers";
import { isSuperAdmin as isSuperAdminHelper } from "~/utils/is-super-admin";
import { DeleteLabelConfirmation } from "../../components/DeleteLabelConfirmation";
import ActivityList from "./components/ActivityList";
import { AttachmentThumbnails } from "./components/AttachmentThumbnails";
import { AttachmentUpload } from "./components/AttachmentUpload";
import Checklists from "./components/Checklists";
import { DeleteCardConfirmation } from "./components/DeleteCardConfirmation";
import { DeleteChecklistConfirmation } from "./components/DeleteChecklistConfirmation";
import { DeleteCommentConfirmation } from "./components/DeleteCommentConfirmation";
import Dropdown from "./components/Dropdown";
import { DueDateSelector } from "./components/DueDateSelector";
import LabelSelector from "./components/LabelSelector";
import ListSelector from "./components/ListSelector";
import MemberSelector from "./components/MemberSelector";
import { NewChecklistForm } from "./components/NewChecklistForm";
import NewCommentForm from "./components/NewCommentForm";

interface FormValues {
  cardId: string;
  title: string;
  description: string;
}

const CARD_SOURCE_OPTIONS = [
  "MANUAL",
  "EMAIL_INBOX",
  "WEB_CLIPPER",
  "LINK",
] as const;
const JOB_LOCATION_TYPE_OPTIONS = ["onsite", "hybrid", "remote"] as const;
const JOB_TYPE_OPTIONS = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
  "TEMPORARY",
  "FREELANCE",
] as const;
const SALARY_REGIONS = ["EU", "US", "UK", "APAC", "Global"] as const;
const SALARY_INTERVAL_OPTIONS = [
  { value: "PER_YEAR", label: t`per year` },
  { value: "PER_MONTH", label: t`per month` },
  { value: "PER_WEEK", label: t`per week` },
  { value: "PER_HOUR", label: t`per hour` },
] as const;
const CURRENCY_OPTIONS = [
  { code: "AED", symbol: "د.إ" },
  { code: "AFN", symbol: "؋" },
  { code: "ALL", symbol: "L" },
  { code: "AMD", symbol: "֏" },
  { code: "ANG", symbol: "ƒ" },
  { code: "AOA", symbol: "Kz" },
  { code: "ARS", symbol: "$" },
  { code: "AUD", symbol: "$" },
  { code: "AWG", symbol: "ƒ" },
  { code: "AZN", symbol: "₼" },
  { code: "BAM", symbol: "KM" },
  { code: "BBD", symbol: "$" },
  { code: "BDT", symbol: "৳" },
  { code: "BGN", symbol: "лв" },
  { code: "BHD", symbol: ".د.ب" },
  { code: "BIF", symbol: "FBu" },
  { code: "BMD", symbol: "$" },
  { code: "BND", symbol: "$" },
  { code: "BOB", symbol: "Bs." },
  { code: "BOV", symbol: "BOV" },
  { code: "BRL", symbol: "R$" },
  { code: "BSD", symbol: "$" },
  { code: "BTN", symbol: "Nu." },
  { code: "BWP", symbol: "P" },
  { code: "BYN", symbol: "Br" },
  { code: "BZD", symbol: "$" },
  { code: "CAD", symbol: "$" },
  { code: "CDF", symbol: "FC" },
  { code: "CHF", symbol: "CHF" },
  { code: "CLF", symbol: "CLF" },
  { code: "CLP", symbol: "$" },
  { code: "CNY", symbol: "¥" },
  { code: "COP", symbol: "$" },
  { code: "COU", symbol: "COU" },
  { code: "CRC", symbol: "₡" },
  { code: "CUP", symbol: "$" },
  { code: "CVE", symbol: "$" },
  { code: "CZK", symbol: "Kč" },
  { code: "DJF", symbol: "Fdj" },
  { code: "DKK", symbol: "kr" },
  { code: "DOP", symbol: "$" },
  { code: "DZD", symbol: "د.ج" },
  { code: "EGP", symbol: "£" },
  { code: "ERN", symbol: "Nfk" },
  { code: "ETB", symbol: "Br" },
  { code: "EUR", symbol: "€" },
  { code: "FJD", symbol: "$" },
  { code: "FKP", symbol: "£" },
  { code: "GBP", symbol: "£" },
  { code: "GEL", symbol: "₾" },
  { code: "GHS", symbol: "₵" },
  { code: "GIP", symbol: "£" },
  { code: "GMD", symbol: "D" },
  { code: "GNF", symbol: "FG" },
  { code: "GTQ", symbol: "Q" },
  { code: "GYD", symbol: "$" },
  { code: "HKD", symbol: "$" },
  { code: "HNL", symbol: "L" },
  { code: "HTG", symbol: "G" },
  { code: "HUF", symbol: "Ft" },
  { code: "IDR", symbol: "Rp" },
  { code: "ILS", symbol: "₪" },
  { code: "INR", symbol: "₹" },
  { code: "IQD", symbol: "ع.د" },
  { code: "IRR", symbol: "﷼" },
  { code: "ISK", symbol: "kr" },
  { code: "JMD", symbol: "$" },
  { code: "JOD", symbol: "د.ا" },
  { code: "JPY", symbol: "¥" },
  { code: "KES", symbol: "KSh" },
  { code: "KGS", symbol: "сом" },
  { code: "KHR", symbol: "៛" },
  { code: "KMF", symbol: "CF" },
  { code: "KPW", symbol: "₩" },
  { code: "KRW", symbol: "₩" },
  { code: "KWD", symbol: "د.ك" },
  { code: "KYD", symbol: "$" },
  { code: "KZT", symbol: "₸" },
  { code: "LAK", symbol: "₭" },
  { code: "LBP", symbol: "ل.ل" },
  { code: "LKR", symbol: "Rs" },
  { code: "LRD", symbol: "$" },
  { code: "LSL", symbol: "L" },
  { code: "LYD", symbol: "ل.د" },
  { code: "MAD", symbol: "د.م." },
  { code: "MDL", symbol: "L" },
  { code: "MGA", symbol: "Ar" },
  { code: "MKD", symbol: "ден" },
  { code: "MMK", symbol: "K" },
  { code: "MNT", symbol: "₮" },
  { code: "MOP", symbol: "P" },
  { code: "MRU", symbol: "UM" },
  { code: "MUR", symbol: "₨" },
  { code: "MVR", symbol: "Rf" },
  { code: "MWK", symbol: "MK" },
  { code: "MXN", symbol: "$" },
  { code: "MXV", symbol: "MXV" },
  { code: "MYR", symbol: "RM" },
  { code: "MZN", symbol: "MT" },
  { code: "NAD", symbol: "$" },
  { code: "NGN", symbol: "₦" },
  { code: "NIO", symbol: "C$" },
  { code: "NOK", symbol: "kr" },
  { code: "NPR", symbol: "₨" },
  { code: "NZD", symbol: "$" },
  { code: "OMR", symbol: "ر.ع." },
  { code: "PAB", symbol: "B/." },
  { code: "PEN", symbol: "S/" },
  { code: "PGK", symbol: "K" },
  { code: "PHP", symbol: "₱" },
  { code: "PKR", symbol: "₨" },
  { code: "PLN", symbol: "zł" },
  { code: "PYG", symbol: "₲" },
  { code: "QAR", symbol: "ر.ق" },
  { code: "RON", symbol: "lei" },
  { code: "RSD", symbol: "дин." },
  { code: "RUB", symbol: "₽" },
  { code: "RWF", symbol: "FRw" },
  { code: "SAR", symbol: "ر.س" },
  { code: "SBD", symbol: "$" },
  { code: "SCR", symbol: "₨" },
  { code: "SDG", symbol: "ج.س." },
  { code: "SEK", symbol: "kr" },
  { code: "SGD", symbol: "$" },
  { code: "SHP", symbol: "£" },
  { code: "SLE", symbol: "Le" },
  { code: "SOS", symbol: "Sh" },
  { code: "SRD", symbol: "$" },
  { code: "SSP", symbol: "£" },
  { code: "STN", symbol: "Db" },
  { code: "SVC", symbol: "$" },
  { code: "SYP", symbol: "£" },
  { code: "SZL", symbol: "L" },
  { code: "THB", symbol: "฿" },
  { code: "TJS", symbol: "ЅМ" },
  { code: "TMT", symbol: "m" },
  { code: "TND", symbol: "د.ت" },
  { code: "TOP", symbol: "T$" },
  { code: "TRY", symbol: "₺" },
  { code: "TTD", symbol: "$" },
  { code: "TWD", symbol: "$" },
  { code: "TZS", symbol: "Sh" },
  { code: "UAH", symbol: "₴" },
  { code: "UGX", symbol: "USh" },
  { code: "USD", symbol: "$" },
  { code: "USN", symbol: "USN" },
  { code: "UYI", symbol: "UYI" },
  { code: "UYU", symbol: "$U" },
  { code: "UYW", symbol: "UYW" },
  { code: "UZS", symbol: "so'm" },
  { code: "VED", symbol: "Bs.D" },
  { code: "VES", symbol: "Bs." },
  { code: "VND", symbol: "₫" },
  { code: "VUV", symbol: "VT" },
  { code: "WST", symbol: "T" },
  { code: "XAF", symbol: "FCFA" },
  { code: "XCD", symbol: "$" },
  { code: "XOF", symbol: "F CFA" },
  { code: "XPF", symbol: "₣" },
  { code: "YER", symbol: "﷼" },
  { code: "ZAR", symbol: "R" },
  { code: "ZMW", symbol: "ZK" },
  { code: "ZWG", symbol: "ZiG" },
] as const;
const TEST_SALARY_COMPARISON_DATA = {
  EU: { min: 55000, max: 92000, currency: "EUR" },
  US: { min: 95000, max: 160000, currency: "USD" },
  UK: { min: 62000, max: 105000, currency: "GBP" },
  APAC: { min: 40000, max: 75000, currency: "USD" },
  Global: { min: 50000, max: 90000, currency: "USD" },
} as const;

type CardSource = (typeof CARD_SOURCE_OPTIONS)[number];
type JobLocationType = (typeof JOB_LOCATION_TYPE_OPTIONS)[number];
type JobType = (typeof JOB_TYPE_OPTIONS)[number];
type SalaryRegion = (typeof SALARY_REGIONS)[number];
type SalaryInterval = (typeof SALARY_INTERVAL_OPTIONS)[number]["value"];

interface SalaryRange {
  min: number | null;
  max: number | null;
  currency: string | null;
}

interface SalaryComparisonRow {
  label: string;
  range: SalaryRange;
  displayRange: SalaryRange;
}

interface ShortlistUpdateFields {
  shortlistCompanyName?: string | null;
  shortlistJobPostingUrl?: string | null;
  shortlistSalaryMin?: number | null;
  shortlistSalaryMax?: number | null;
  shortlistSalaryCurrency?: string | null;
  shortlistSalaryInterval?: SalaryInterval;
  shortlistCardSource?: CardSource;
  shortlistJobLocation?: string | null;
  shortlistJobLocationType?: JobLocationType | null;
  shortlistJobType?: JobType;
  shortlistCompanyLocation?: string | null;
}

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const integerOrNull = (value: string) => {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const formatSource = (source: string) => {
  switch (source) {
    case "MANUAL":
      return t`Manually`;
    case "EMAIL_INBOX":
      return t`Magic Inbox`;
    case "WEB_CLIPPER":
    case "WEBCLIPPER":
      return t`Web Clipper`;
    case "LINK":
      return t`Link`;
    default:
      return source;
  }
};

const formatEnumLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatCurrencyAmount = (
  amount: number | null,
  currency: string | null,
) => {
  if (amount === null) return "";

  const symbol = CURRENCY_OPTIONS.find(
    (option) => option.code === currency,
  )?.symbol;
  const compact =
    Math.abs(amount) >= 1000 ? `${Math.round(amount / 1000)}k` : `${amount}`;

  return `${symbol ? symbol : currency ? `${currency} ` : ""}${compact}`;
};

const formatSalaryRange = (range: SalaryRange) => {
  if (range.min === null && range.max === null) return "";
  if (range.min !== null && range.max !== null && range.min !== range.max) {
    return `${formatCurrencyAmount(range.min, range.currency)} – ${formatCurrencyAmount(range.max, range.currency)}`;
  }

  return formatCurrencyAmount(range.min ?? range.max, range.currency);
};

const formatDisplayUrl = (url: string) =>
  url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");

const getOfferComparisonRange = (offer: SalaryRange) => {
  const value = offer.min ?? offer.max;
  if (value === null) return null;

  if (offer.min !== null && offer.max !== null && offer.min !== offer.max) {
    return offer;
  }

  return {
    min: Math.round(value * 0.9),
    max: Math.round(value * 1.1),
    currency: offer.currency,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toSalaryRange = (value: unknown): SalaryRange | null => {
  if (!isRecord(value)) return null;

  const min = typeof value.min === "number" ? value.min : null;
  const max = typeof value.max === "number" ? value.max : null;
  const currency = typeof value.currency === "string" ? value.currency : null;

  if (min === null && max === null) return null;

  return { min, max, currency };
};

const getSalaryComparisonRanges = (salaryData: unknown) => {
  const source = isRecord(salaryData)
    ? isRecord(salaryData.comparedRanges)
      ? salaryData.comparedRanges
      : salaryData
    : {};

  return SALARY_REGIONS.map((region) => {
    const value = isRecord(source)
      ? (source[region] ?? source[region.toLowerCase()])
      : undefined;

    return {
      region,
      range: toSalaryRange(value),
    };
  }).filter((item): item is { region: SalaryRegion; range: SalaryRange } =>
    Boolean(item.range),
  );
};

function SalaryComparisonBars({
  offer,
  salaryData,
}: {
  offer: SalaryRange;
  salaryData: unknown;
}) {
  const comparisonRanges = getSalaryComparisonRanges(salaryData);
  const offerComparisonRange = getOfferComparisonRange(offer);
  const rows: SalaryComparisonRow[] = [
    ...(offerComparisonRange
      ? [
          {
            label: t`Offer`,
            range: offerComparisonRange,
            displayRange: offer,
          },
        ]
      : []),
    ...comparisonRanges.map((item) => ({
      label: item.region,
      range: item.range,
      displayRange: item.range,
    })),
  ];
  const allRanges = rows.map((item) => item.range);

  const values = allRanges.flatMap((range) =>
    [range.min, range.max].filter((value): value is number => value !== null),
  );
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const span = Math.max(1, maxValue - minValue);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-light-700 dark:text-dark-800">
        {t`No salary comparison data yet.`}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map(({ label, range, displayRange }) => {
        const rangeMin = range.min ?? range.max ?? minValue;
        const rangeMax = range.max ?? range.min ?? rangeMin;
        const left = ((rangeMin - minValue) / span) * 100;
        const width = Math.max(3, ((rangeMax - rangeMin) / span) * 100);

        return (
          <div
            key={label}
            className="grid grid-cols-[44px_1fr] items-center gap-2"
          >
            <span className="text-xs font-light text-light-900 dark:text-dark-900">
              {label}
            </span>
            <div>
              <div className="relative h-3 rounded-full bg-light-200 dark:bg-dark-200">
                <div
                  className="absolute top-0 h-3 rounded-full bg-light-900 dark:bg-dark-900"
                  style={{
                    left: `${Math.min(100, Math.max(0, left))}%`,
                    width: `${Math.min(100, width)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-light-900 dark:text-dark-900">
                {formatSalaryRange(displayRange)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CardRightPanel({ isTemplate }: { isTemplate?: boolean }) {
  const router = useRouter();
  const { canEditCard } = usePermissions();
  const { showPopup } = usePopup();
  const { data: session } = authClient.useSession();
  const utils = api.useUtils();
  const cardId = Array.isArray(router.query.cardId)
    ? router.query.cardId[0]
    : router.query.cardId;

  const { data: card } = api.card.byId.useQuery(
    { cardPublicId: cardId ?? "" },
    { enabled: !!cardId && cardId.length >= 12 },
  );

  const isCreator = card?.createdBy && session?.user.id === card.createdBy;
  const canEdit = canEditCard || isCreator;

  const board = card?.list.board;
  const labels = board?.labels;
  const workspaceMembers = board?.workspace.members;
  const selectedLabels = card?.labels;
  const selectedMembers = card?.members;
  const [shortlistDraft, setShortlistDraft] = useState({
    companyName: "",
    jobPostingUrl: "",
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "",
    jobLocation: "",
    companyLocation: "",
  });
  const [salaryIsRange, setSalaryIsRange] = useState(true);
  const [isEditingJobUrl, setIsEditingJobUrl] = useState(false);
  const [isEditingSalaryInterval, setIsEditingSalaryInterval] = useState(false);
  const [isSalaryComparisonOpen, setIsSalaryComparisonOpen] = useState(false);

  const updateManualUpdatedOnly = api.card.update.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel();

      const previousCard = utils.card.byId.getData({
        cardPublicId: cardId ?? "",
      });

      if (cardId) {
        utils.card.byId.setData({ cardPublicId: cardId }, (oldCard) => {
          if (!oldCard || update.manualUpdatedOnly === undefined)
            return oldCard;

          return {
            ...oldCard,
            manualUpdatedOnly: update.manualUpdatedOnly,
          };
        });
      }

      return { previousCard };
    },
    onError: (_error, _update, context) => {
      if (cardId) {
        utils.card.byId.setData(
          { cardPublicId: cardId },
          context?.previousCard,
        );
      }
      showPopup({
        header: t`Unable to update card`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      if (cardId) {
        await invalidateCard(utils, cardId);
      }
      await utils.board.byId.invalidate();
    },
  });

  const updateShortlistFields = api.card.update.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel();

      const previousCard = utils.card.byId.getData({
        cardPublicId: cardId ?? "",
      });

      if (cardId) {
        utils.card.byId.setData({ cardPublicId: cardId }, (oldCard) => {
          if (!oldCard) return oldCard;

          const { cardPublicId: _cardPublicId, ...fields } = update;
          return {
            ...oldCard,
            ...fields,
          };
        });
      }

      return { previousCard };
    },
    onError: (_error, _update, context) => {
      if (cardId) {
        utils.card.byId.setData(
          { cardPublicId: cardId },
          context?.previousCard,
        );
      }
      showPopup({
        header: t`Unable to update details`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      if (cardId) {
        await invalidateCard(utils, cardId);
      }
      await utils.board.byId.invalidate();
    },
  });

  const handleManualUpdatedOnlyToggle = () => {
    if (!cardId || !card || !canEdit) return;

    updateManualUpdatedOnly.mutate({
      cardPublicId: cardId,
      manualUpdatedOnly: !card.manualUpdatedOnly,
    });
  };

  const commitShortlistFields = (fields: ShortlistUpdateFields) => {
    if (!cardId || !card || !canEdit) return;

    updateShortlistFields.mutate({
      cardPublicId: cardId,
      ...fields,
    });
  };

  const updateDraft = (field: keyof typeof shortlistDraft, value: string) => {
    setShortlistDraft((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (!card) return;

    setShortlistDraft({
      companyName: card.shortlistCompanyName ?? "",
      jobPostingUrl: card.shortlistJobPostingUrl ?? "",
      salaryMin:
        card.shortlistSalaryMin !== null ? String(card.shortlistSalaryMin) : "",
      salaryMax:
        card.shortlistSalaryMax !== null ? String(card.shortlistSalaryMax) : "",
      salaryCurrency: card.shortlistSalaryCurrency ?? "",
      jobLocation: card.shortlistJobLocation ?? "",
      companyLocation: card.shortlistCompanyLocation ?? "",
    });
  }, [
    card?.publicId,
    card?.shortlistCompanyName,
    card?.shortlistJobPostingUrl,
    card?.shortlistSalaryMin,
    card?.shortlistSalaryMax,
    card?.shortlistSalaryCurrency,
    card?.shortlistJobLocation,
    card?.shortlistCompanyLocation,
  ]);

  const formattedLabels =
    labels?.map((label) => {
      const isSelected = selectedLabels?.some(
        (selectedLabel) => selectedLabel.publicId === label.publicId,
      );

      return {
        key: label.publicId,
        value: label.name,
        selected: isSelected ?? false,
        colourCode: label.colourCode,
        leftIcon: <LabelIcon colourCode={label.colourCode} />,
      };
    }) ?? [];

  const formattedLists =
    board?.lists.map((list) => ({
      key: list.publicId,
      value: list.name,
      selected: list.publicId === card?.list.publicId,
    })) ?? [];

  const formattedMembers =
    workspaceMembers?.map((member) => {
      const isSelected = selectedMembers?.some(
        (assignedMember) => assignedMember.publicId === member.publicId,
      );

      return {
        key: member.publicId,
        value: formatMemberDisplayName(
          member.user?.name ?? null,
          member.user?.email ?? member.email,
        ),
        imageUrl: member.user?.image
          ? getAvatarUrl(member.user.image)
          : undefined,
        selected: isSelected ?? false,
        leftIcon: (
          <Avatar
            size="xs"
            name={member.user?.name ?? ""}
            imageUrl={
              member.user?.image ? getAvatarUrl(member.user.image) : undefined
            }
            email={member.user?.email ?? member.email}
          />
        ),
      };
    }) ?? [];

  const inputClass =
    "w-full rounded-[5px] border border-light-300 bg-light-50 px-2 py-1 text-xs text-light-1000 focus:border-light-600 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-300 dark:bg-dark-50 dark:text-dark-1000 dark:focus:border-dark-600";
  const detailGroupClass =
    "space-y-1 rounded-[8px] border border-light-300 p-3 dark:border-dark-300";
  const detailRowClass =
    "grid min-h-[48px] grid-cols-[22px_92px_1fr] items-center gap-x-1 gap-y-2";
  const detailTextRowClass =
    "grid grid-cols-[22px_92px_1fr] items-start gap-x-1 gap-y-2 py-2";
  const detailIconClass = "h-4 w-4 text-light-900 dark:text-dark-900";
  const detailLabelClass =
    "text-xs font-medium text-light-900 dark:text-dark-900";
  const ratingValue =
    card?.shortlistCompanyRatingAggregated !== null &&
    card?.shortlistCompanyRatingAggregated !== undefined
      ? Math.min(5, Math.max(0, Number(card.shortlistCompanyRatingAggregated)))
      : null;
  const salaryOffer = {
    min: card?.shortlistSalaryMin ?? null,
    max: card?.shortlistSalaryMax ?? null,
    currency: card?.shortlistSalaryCurrency ?? null,
  };
  const salaryIntervalLabel =
    SALARY_INTERVAL_OPTIONS.find(
      (option) => option.value === card?.shortlistSalaryInterval,
    )?.label ?? t`per month`;

  const commitSalaryFields = (currency = shortlistDraft.salaryCurrency) => {
    const singleSalary = integerOrNull(shortlistDraft.salaryMax);
    const min = salaryIsRange
      ? integerOrNull(shortlistDraft.salaryMin)
      : singleSalary;
    const max = salaryIsRange
      ? integerOrNull(shortlistDraft.salaryMax)
      : singleSalary;

    commitShortlistFields({
      shortlistSalaryMin: min,
      shortlistSalaryMax: max,
      shortlistSalaryCurrency: emptyToNull(currency.toUpperCase()),
    });
  };

  const commitJobUrl = (input: HTMLInputElement) => {
    if (!input.validity.valid) {
      input.reportValidity();
      return;
    }

    commitShortlistFields({
      shortlistJobPostingUrl: emptyToNull(shortlistDraft.jobPostingUrl),
    });
    setIsEditingJobUrl(false);
  };

  const commitOnEnter = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    commit: () => void,
  ) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  };

  return (
    <div className="h-full w-[360px] overflow-y-auto border-l-[1px] border-light-300 bg-light-50 p-6 text-light-900 dark:border-dark-300 dark:bg-dark-50 dark:text-dark-900">
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-light-300 bg-light-100 text-light-900 dark:border-dark-300 dark:bg-dark-100 dark:text-dark-900">
            <HiOutlineBriefcase className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-light-1000 dark:text-dark-1000">
            {t`Opportunity details`}
          </h2>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <HiOutlineDocumentText className="h-5 w-5 text-light-900 dark:text-dark-900" />
          <h3 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
            {t`Details`}
          </h3>
        </div>
        <div className={detailGroupClass}>
          <div className={detailRowClass}>
            <HiOutlineBars3BottomLeft className={detailIconClass} />
            <span className={detailLabelClass}>{t`Status`}</span>
            <ListSelector
              cardPublicId={cardId ?? ""}
              lists={formattedLists}
              isLoading={!card}
              disabled={!canEdit}
              menuPosition="right"
            />
          </div>
          <div className={detailRowClass}>
            <HiOutlineCalendarDays className={detailIconClass} />
            <span className={detailLabelClass}>{t`Interview`}</span>
            <DueDateSelector
              cardPublicId={cardId ?? ""}
              dueDate={card?.dueDate}
              isLoading={!card}
              disabled={!canEdit}
              popoverPosition="right"
            />
          </div>
          <div className={detailRowClass}>
            <HiOutlineDocumentText className={detailIconClass} />
            <span className={detailLabelClass}>{t`Created`}</span>
            <select
              value={card?.shortlistCardSource ?? "MANUAL"}
              onChange={(event) =>
                commitShortlistFields({
                  shortlistCardSource: event.target.value as CardSource,
                })
              }
              disabled={!canEdit}
              className={inputClass}
            >
              {CARD_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatSource(option)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <HiOutlineBriefcase className="h-5 w-5 text-light-900 dark:text-dark-900" />
          <h3 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
            {t`Role`}
          </h3>
        </div>
        <div className={detailGroupClass}>
          <div className={detailRowClass}>
            <HiOutlineBuildingOffice2 className={detailIconClass} />
            <span className={detailLabelClass}>{t`Company`}</span>
            <input
              type="text"
              value={shortlistDraft.companyName}
              onChange={(event) =>
                updateDraft("companyName", event.target.value)
              }
              onBlur={() =>
                commitShortlistFields({
                  shortlistCompanyName: emptyToNull(shortlistDraft.companyName),
                })
              }
              onKeyDown={(event) =>
                commitOnEnter(event, () =>
                  commitShortlistFields({
                    shortlistCompanyName: emptyToNull(
                      shortlistDraft.companyName,
                    ),
                  }),
                )
              }
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
          <div className={detailRowClass}>
            <HiOutlineBriefcase className={detailIconClass} />
            <span className={detailLabelClass}>{t`Contract`}</span>
            <select
              value={card?.shortlistJobType ?? "FULL_TIME"}
              onChange={(event) =>
                commitShortlistFields({
                  shortlistJobType: event.target.value as JobType,
                })
              }
              disabled={!canEdit}
              className={inputClass}
            >
              {JOB_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatEnumLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div className={detailRowClass}>
            <LuTreePalm className={detailIconClass} />
            <span className={detailLabelClass}>{t`Location type`}</span>
            <select
              value={card?.shortlistJobLocationType ?? ""}
              onChange={(event) =>
                commitShortlistFields({
                  shortlistJobLocationType:
                    event.target.value.length > 0
                      ? (event.target.value as JobLocationType)
                      : null,
                })
              }
              disabled={!canEdit}
              className={inputClass}
            >
              <option value="">{t`unknown`}</option>
              {JOB_LOCATION_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatEnumLabel(option)}
                </option>
              ))}
            </select>
          </div>
          {card?.shortlistJobLocationType !== "remote" && (
            <div className={detailRowClass}>
              <HiOutlineMapPin className={detailIconClass} />
              <span className={detailLabelClass}>{t`Job location`}</span>
              <input
                type="text"
                value={shortlistDraft.jobLocation}
                onChange={(event) =>
                  updateDraft("jobLocation", event.target.value)
                }
                onBlur={() =>
                  commitShortlistFields({
                    shortlistJobLocation: emptyToNull(
                      shortlistDraft.jobLocation,
                    ),
                  })
                }
                onKeyDown={(event) =>
                  commitOnEnter(event, () =>
                    commitShortlistFields({
                      shortlistJobLocation: emptyToNull(
                        shortlistDraft.jobLocation,
                      ),
                    }),
                  )
                }
                disabled={!canEdit}
                className={inputClass}
              />
            </div>
          )}
          <div className={detailRowClass}>
            <HiOutlineLink className={detailIconClass} />
            <span className={detailLabelClass}>{t`Job URL`}</span>
            {isEditingJobUrl ? (
              <input
                type="url"
                value={shortlistDraft.jobPostingUrl}
                onChange={(event) =>
                  updateDraft("jobPostingUrl", event.target.value)
                }
                onBlur={(event) => commitJobUrl(event.currentTarget)}
                onKeyDown={(event) =>
                  commitOnEnter(event, () => commitJobUrl(event.currentTarget))
                }
                disabled={!canEdit}
                className={inputClass}
                autoFocus
              />
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                {card?.shortlistJobPostingUrl ? (
                  <a
                    href={card.shortlistJobPostingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs font-medium text-light-1000 underline underline-offset-2 dark:text-dark-1000"
                  >
                    {formatDisplayUrl(card.shortlistJobPostingUrl)}
                  </a>
                ) : (
                  <span aria-hidden="true" />
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsEditingJobUrl(true)}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[5px] text-light-900 hover:bg-light-200 dark:text-dark-900 dark:hover:bg-dark-200"
                    aria-label={t`Edit job URL`}
                  >
                    <HiOutlinePencilSquare className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <HiOutlineBuildingOffice2 className="h-5 w-5 text-light-900 dark:text-dark-900" />
          <h3 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
            {t`Company insights`}
          </h3>
        </div>
        <div className={detailGroupClass}>
          <div className={detailRowClass}>
            <HiOutlineBuildingOffice2 className={detailIconClass} />
            <span className={detailLabelClass}>{t`Company HQ`}</span>
            <input
              type="text"
              value={shortlistDraft.companyLocation}
              onChange={(event) =>
                updateDraft("companyLocation", event.target.value)
              }
              onBlur={() =>
                commitShortlistFields({
                  shortlistCompanyLocation: emptyToNull(
                    shortlistDraft.companyLocation,
                  ),
                })
              }
              onKeyDown={(event) =>
                commitOnEnter(event, () =>
                  commitShortlistFields({
                    shortlistCompanyLocation: emptyToNull(
                      shortlistDraft.companyLocation,
                    ),
                  }),
                )
              }
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
          <div className={detailRowClass}>
            <HiOutlineStar className={detailIconClass} />
            <span className={detailLabelClass}>{t`Rating`}</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 text-yellow-500">
                {Array.from({ length: 5 }, (_, index) => {
                  const isFilled = index < Math.round(ratingValue ?? 0);
                  const StarIcon = isFilled ? HiStar : HiOutlineStar;

                  return <StarIcon key={index} className="h-3.5 w-3.5" />;
                })}
              </div>
            </div>
          </div>
          <div className={detailTextRowClass}>
            <HiOutlineChatBubbleLeftRight className={detailIconClass} />
            <span className={detailLabelClass}>{t`Sentiment`}</span>
            <p className="text-xs leading-5 text-light-900 dark:text-dark-900">
              {card?.shortlistCompanySentimentSummary
                ? `"${card.shortlistCompanySentimentSummary}"`
                : t`No sentiment summary yet.`}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <HiOutlineBanknotes className="h-5 w-5 text-light-900 dark:text-dark-900" />
          <h3 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
            {t`Salary`}
          </h3>
        </div>
        <div className="space-y-3 rounded-[8px] border border-light-300 p-4 dark:border-dark-300">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-light-900 dark:text-dark-900">
                {t`Company offers`}
              </p>
            </div>
            <Toggle
              label={t`As range`}
              isChecked={salaryIsRange}
              onChange={() => {
                const nextIsRange = !salaryIsRange;
                setSalaryIsRange(nextIsRange);

                if (!nextIsRange) {
                  const salaryValue =
                    integerOrNull(shortlistDraft.salaryMax) ??
                    integerOrNull(shortlistDraft.salaryMin);
                  setShortlistDraft((current) => ({
                    ...current,
                    salaryMin: salaryValue !== null ? String(salaryValue) : "",
                    salaryMax: salaryValue !== null ? String(salaryValue) : "",
                  }));
                  commitShortlistFields({
                    shortlistSalaryMin: salaryValue,
                    shortlistSalaryMax: salaryValue,
                  });
                }
              }}
              disabled={!canEdit}
              labelPosition="before"
            />
          </div>
          <div
            className={`grid gap-2 ${salaryIsRange ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <input
              type="number"
              min={0}
              placeholder={salaryIsRange ? t`Min` : t`Salary`}
              value={
                salaryIsRange
                  ? shortlistDraft.salaryMin
                  : shortlistDraft.salaryMax
              }
              onChange={(event) => {
                if (salaryIsRange) {
                  updateDraft("salaryMin", event.target.value);
                  return;
                }

                setShortlistDraft((current) => ({
                  ...current,
                  salaryMin: event.target.value,
                  salaryMax: event.target.value,
                }));
              }}
              onBlur={() => commitSalaryFields()}
              onKeyDown={(event) => commitOnEnter(event, commitSalaryFields)}
              disabled={!canEdit}
              className={inputClass}
            />
            {salaryIsRange && (
              <input
                type="number"
                min={0}
                placeholder={t`Max`}
                value={shortlistDraft.salaryMax}
                onChange={(event) =>
                  updateDraft("salaryMax", event.target.value)
                }
                onBlur={() => commitSalaryFields()}
                onKeyDown={(event) => commitOnEnter(event, commitSalaryFields)}
                disabled={!canEdit}
                className={inputClass}
              />
            )}
            <select
              value={shortlistDraft.salaryCurrency}
              onChange={(event) => {
                updateDraft("salaryCurrency", event.target.value);
                commitSalaryFields(event.target.value);
              }}
              onBlur={() => commitSalaryFields()}
              disabled={!canEdit}
              className={inputClass}
            >
              <option value="">{t`Currency`}</option>
              {CURRENCY_OPTIONS.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} / {currency.symbol}
                </option>
              ))}
            </select>
          </div>
          <div className="!mt-0 flex justify-end">
            {isEditingSalaryInterval ? (
              <select
                value={card?.shortlistSalaryInterval ?? "PER_MONTH"}
                onChange={(event) => {
                  commitShortlistFields({
                    shortlistSalaryInterval: event.target
                      .value as SalaryInterval,
                  });
                  setIsEditingSalaryInterval(false);
                }}
                onBlur={() => setIsEditingSalaryInterval(false)}
                disabled={!canEdit}
                className={inputClass}
                autoFocus
              >
                {SALARY_INTERVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => canEdit && setIsEditingSalaryInterval(true)}
                disabled={!canEdit}
                className="text-xs font-normal text-light-900 underline underline-offset-2 hover:text-light-1000 disabled:cursor-not-allowed disabled:opacity-60 dark:text-dark-900 dark:hover:text-dark-1000"
              >
                {salaryIntervalLabel}
              </button>
            )}
          </div>
          <div className="border-t border-light-300 pt-3 dark:border-dark-300">
            <button
              type="button"
              onClick={() => setIsSalaryComparisonOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-[5px] py-1 text-left text-xs font-medium text-light-900 hover:text-light-1000 dark:text-dark-900 dark:hover:text-dark-1000"
            >
              <span>{t`Compare salary`}</span>
              <IoChevronForwardSharp
                className={`h-3 w-3 transition-transform ${
                  isSalaryComparisonOpen ? "rotate-90" : ""
                }`}
              />
            </button>
            {isSalaryComparisonOpen && (
              <div className="pt-3">
                <SalaryComparisonBars
                  offer={salaryOffer}
                  salaryData={
                    card?.shortlistSalaryData ?? TEST_SALARY_COMPARISON_DATA
                  }
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <HiOutlineTag className="h-5 w-5 text-light-900 dark:text-dark-900" />
          <h3 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
            {t`Labels`}
          </h3>
        </div>
        <div className={detailGroupClass}>
          <LabelSelector
            cardPublicId={cardId ?? ""}
            labels={formattedLabels}
            isLoading={!card}
            disabled={!canEdit}
          />
        </div>
      </section>

      {!isTemplate && isSuperAdminHelper() && (
        <>
          <section className="mt-8">
            <h3 className="mb-4 text-sm font-semibold text-light-1000 dark:text-dark-1000">
              {t`Members`}
            </h3>
            <MemberSelector
              cardPublicId={cardId ?? ""}
              members={formattedMembers}
              isLoading={!card}
              disabled={!canEdit}
            />
          </section>
        </>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <HiOutlineShieldCheck className="h-5 w-5 text-light-900 dark:text-dark-900" />
          <h3 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
            {t`Automation`}
          </h3>
        </div>
        <div className="rounded-[8px] border border-light-300 p-5 dark:border-dark-300">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
                {t`Auto-updates`}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-[5px] bg-light-200 px-2 py-1 text-sm font-medium text-light-900 dark:bg-dark-200 dark:text-dark-900">
                {card?.manualUpdatedOnly ? (
                  <>
                    <HiOutlineLockClosed className="h-4 w-4" />
                    {t`Manual`}
                  </>
                ) : (
                  <>
                    <HiOutlineShieldCheck className="h-4 w-4" />
                    {t`Automatic`}
                  </>
                )}
              </span>
            </div>
            <Toggle
              label={t`Auto-updates`}
              isChecked={!(card?.manualUpdatedOnly ?? false)}
              onChange={handleManualUpdatedOnlyToggle}
              disabled={!card || !canEdit || updateManualUpdatedOnly.isPending}
              showLabel={false}
            />
          </div>
          <p className="text-sm leading-6 text-light-700 dark:text-dark-800">
            {t`When off, AI and background automations cannot edit this card.`}
          </p>
        </div>
      </section>
    </div>
  );
}

export default function CardPage({ isTemplate }: { isTemplate?: boolean }) {
  const router = useRouter();
  const utils = api.useUtils();
  const {
    modalContentType,
    entityId,
    getModalState,
    clearModalState,
    isOpen,
    modalStates,
  } = useModal();
  const { showPopup } = usePopup();
  const { workspace } = useWorkspace();
  const { canEditCard } = usePermissions();
  const { data: session } = authClient.useSession();
  const [activeChecklistForm, setActiveChecklistForm] = useState<string | null>(
    null,
  );
  const [showOnlyComments, setShowOnlyComments] = useState(false);

  const cardId = Array.isArray(router.query.cardId)
    ? router.query.cardId[0]
    : router.query.cardId;

  const {
    data: card,
    isLoading,
    error,
  } = api.card.byId.useQuery(
    { cardPublicId: cardId ?? "" },
    { enabled: !!cardId && cardId.length >= 12 },
  );

  // Redirect to 404 if card doesn't exist
  useEffect(() => {
    if (router.isReady && cardId && !isLoading) {
      if (error?.data?.code === "NOT_FOUND" || (!card && !isLoading)) {
        router.replace("/404");
      }
    }
  }, [router, cardId, isLoading, error, card]);

  const isCreator = card?.createdBy && session?.user.id === card.createdBy;
  const canEdit = canEditCard || isCreator;

  const refetchCard = async () => {
    if (cardId) await utils.card.byId.refetch({ cardPublicId: cardId });
  };

  const board = card?.list.board;
  const workspaceMembers = board?.workspace.members;
  const boardId = board?.publicId;

  const editorWorkspaceMembers =
    workspaceMembers
      ?.filter((member) => member.email)
      .map((member) => ({
        publicId: member.publicId,
        email: member.email,
        user: member.user
          ? {
              id: member.user.id,
              name: member.user.name ?? null,
              image: member.user.image ?? null,
            }
          : null,
      })) ?? [];

  const updateCard = api.card.update.useMutation({
    onError: () => {
      showPopup({
        header: t`Unable to update card`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      if (cardId) await invalidateCard(utils, cardId);
    },
  });

  const addOrRemoveLabel = api.card.addOrRemoveLabel.useMutation({
    onError: () => {
      showPopup({
        header: t`Unable to add label`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      if (cardId) {
        await utils.card.byId.invalidate({ cardPublicId: cardId });
      }
    },
  });

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    values: {
      cardId: cardId ?? "",
      title: card?.title ?? "",
      description: card?.description ?? "",
    },
  });

  const onSubmit = (values: FormValues) => {
    updateCard.mutate({
      cardPublicId: values.cardId,
      title: values.title,
      description: values.description,
    });
  };

  // this adds the new created label to selected labels
  useEffect(() => {
    const newLabelId = modalStates.NEW_LABEL_CREATED;
    if (newLabelId && cardId) {
      const isAlreadyAdded = card?.labels.some(
        (label) => label.publicId === newLabelId,
      );

      if (!isAlreadyAdded) {
        addOrRemoveLabel.mutate({
          cardPublicId: cardId,
          labelPublicId: newLabelId,
        });
      }
      clearModalState("NEW_LABEL_CREATED");
    }
  }, [modalStates.NEW_LABEL_CREATED, card, cardId]);

  // Open the new item form after creating a new checklist
  useEffect(() => {
    if (!card) return;
    const state = getModalState("ADD_CHECKLIST");
    const createdId: string | undefined = state?.createdChecklistId;
    if (createdId) {
      setActiveChecklistForm(createdId);
      clearModalState("ADD_CHECKLIST");
    }
  }, [card, getModalState, clearModalState]);

  // Auto-resize title textarea
  useEffect(() => {
    const titleTextarea = document.getElementById(
      "title",
    ) as HTMLTextAreaElement;
    if (titleTextarea) {
      titleTextarea.style.height = "auto";
      titleTextarea.style.height = `${titleTextarea.scrollHeight}px`;
    }
  }, [card]);

  if (!cardId) return <></>;

  return (
    <>
      <PageHead
        title={t`${card?.title ?? t`Card`} | ${board?.name ?? t`Board`}`}
      />
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Full-width top strip with board link and dropdown */}
        <div className="flex w-full items-center justify-between border-b-[1px] border-light-300 bg-light-50 px-8 py-2 dark:border-dark-300 dark:bg-dark-50">
          {!card && isLoading && (
            <div className="flex space-x-2">
              <div className="h-[1.5rem] w-[150px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
            </div>
          )}
          {card && (
            <>
              <div className="flex items-center gap-1">
                <Link
                  className="whitespace-nowrapleading-[1.5rem] text-sm font-bold text-light-900 dark:text-dark-950"
                  href={`${isTemplate ? "/templates" : "/boards"}`}
                >
                  {workspace.name}
                </Link>
                <IoChevronForwardSharp className="h-[10px] w-[10px] text-light-900 dark:text-dark-900" />
                <Link
                  className="whitespace-nowrap text-sm font-bold leading-[1.5rem] text-light-900 dark:text-dark-950"
                  href={`${isTemplate ? "/templates" : "/boards"}/${board?.publicId}`}
                >
                  {board?.name}
                </Link>
                <IoChevronForwardSharp className="h-[10px] w-[10px] flex-shrink-0 text-light-900 dark:text-dark-900" />
                <span className="truncate text-sm font-bold leading-[1.5rem] text-light-700 dark:text-dark-800">
                  {card.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Dropdown
                  cardPublicId={cardId}
                  cardCreatedBy={card?.createdBy}
                  listPublicId={card?.list.publicId}
                  cardIndex={card?.index}
                />
                <Link
                  href={`/${isTemplate ? "templates" : "boards"}/${boardId}`}
                  className="flex h-7 w-7 items-center justify-center rounded-[5px] text-light-900 hover:bg-light-200 dark:text-dark-900 dark:hover:bg-dark-200"
                  aria-label={t`Close`}
                >
                  <HiXMark className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
          {!card && !isLoading && (
            <p className="block p-0 py-0 font-bold leading-[1.5rem] tracking-tight text-light-900 dark:text-dark-900 sm:text-[1rem]">
              {t`Card not found`}
            </p>
          )}
        </div>
        <div className="scrollbar-thumb-rounded-[4px] scrollbar-track-rounded-[4px] w-full flex-1 overflow-y-auto scrollbar scrollbar-track-light-200 scrollbar-thumb-light-400 hover:scrollbar-thumb-light-400 dark:scrollbar-track-dark-100 dark:scrollbar-thumb-dark-300 dark:hover:scrollbar-thumb-dark-300">
          <div className="p-auto mx-auto flex h-full w-full max-w-[800px] flex-col">
            <div className="p-6 md:p-8">
              <div className="mb-8 md:mt-4">
                {!card && isLoading && (
                  <div className="flex space-x-2">
                    <div className="h-[2.3rem] w-[300px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
                  </div>
                )}
                {card && (
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="w-full space-y-6"
                  >
                    <div>
                      <textarea
                        id="title"
                        {...register("title")}
                        onBlur={canEdit ? handleSubmit(onSubmit) : undefined}
                        rows={1}
                        disabled={!canEdit}
                        className={`block w-full resize-none overflow-hidden border-0 bg-transparent p-0 py-0 font-bold leading-relaxed text-neutral-900 focus:ring-0 dark:text-dark-1000 sm:text-[1.2rem] ${!canEdit ? "cursor-default" : ""}`}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = "auto";
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    </div>
                  </form>
                )}
                {!card && !isLoading && (
                  <p className="block p-0 py-0 font-bold leading-[2.3rem] tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
                    {t`Card not found`}
                  </p>
                )}
              </div>
              {card && (
                <>
                  <div className="mb-10 flex w-full max-w-2xl flex-col justify-between">
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="w-full space-y-6"
                    >
                      <div className="mt-2">
                        <Editor
                          content={card.description}
                          onChange={
                            canEdit
                              ? (e) => setValue("description", e)
                              : undefined
                          }
                          onBlur={
                            canEdit ? () => handleSubmit(onSubmit)() : undefined
                          }
                          workspaceMembers={workspaceMembers ?? []}
                          readOnly={!canEdit}
                        />
                      </div>
                    </form>
                  </div>
                  <div className="mb-8 border-t border-light-300 dark:border-dark-300" />
                  <Checklists
                    checklists={card.checklists}
                    cardPublicId={cardId}
                    activeChecklistForm={activeChecklistForm}
                    setActiveChecklistForm={setActiveChecklistForm}
                    viewOnly={!canEdit}
                  />
                  {!isTemplate && (
                    <>
                      {card?.attachments.length > 0 && (
                        <div className="mt-6">
                          <AttachmentThumbnails
                            attachments={card.attachments}
                            cardPublicId={cardId ?? ""}
                            isReadOnly={!canEdit}
                          />
                        </div>
                      )}
                      {canEdit && (
                        <div className="mt-6">
                          <AttachmentUpload cardPublicId={cardId} />
                        </div>
                      )}
                    </>
                  )}
                  <div className="border-t-[1px] border-light-300 pt-12 dark:border-dark-300">
                    {!isTemplate && (
                      <div className="mb-6">
                        <NewCommentForm
                          cardPublicId={cardId}
                          workspaceMembers={editorWorkspaceMembers}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between pb-4">
                      <h2 className="text-md font-medium text-light-1000 dark:text-dark-1000">
                        {t`History`}
                      </h2>
                      <Toggle
                        label={t`Show only comments`}
                        isChecked={showOnlyComments}
                        onChange={() =>
                          setShowOnlyComments((current) => !current)
                        }
                        labelPosition="before"
                      />
                    </div>
                    <div>
                      <ActivityList
                        cardPublicId={cardId}
                        isLoading={!card}
                        isAdmin={workspace.role === "admin"}
                        mode={showOnlyComments ? "notes" : "history"}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <>
          <Modal
            modalSize="md"
            isVisible={isOpen && modalContentType === "NEW_FEEDBACK"}
          >
            <FeedbackModal />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "NEW_LABEL"}
          >
            <LabelForm boardPublicId={boardId ?? ""} refetch={refetchCard} />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "EDIT_LABEL"}
          >
            <LabelForm
              boardPublicId={boardId ?? ""}
              refetch={refetchCard}
              isEdit
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_LABEL"}
          >
            <DeleteLabelConfirmation
              refetch={refetchCard}
              labelPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_CARD"}
          >
            <DeleteCardConfirmation
              boardPublicId={boardId ?? ""}
              cardPublicId={cardId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_COMMENT"}
          >
            <DeleteCommentConfirmation
              cardPublicId={cardId}
              commentPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "NEW_WORKSPACE"}
          >
            <NewWorkspaceForm />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "ADD_CHECKLIST"}
          >
            <NewChecklistForm cardPublicId={cardId} />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_CHECKLIST"}
          >
            <DeleteChecklistConfirmation
              cardPublicId={cardId}
              checklistPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "EDIT_YOUTUBE"}
          >
            <EditYouTubeModal />
          </Modal>
        </>
      </div>
    </>
  );
}
