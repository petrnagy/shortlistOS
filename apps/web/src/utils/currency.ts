export type CurrencySymbolPosition = "prefix" | "suffix";

export interface CompactCurrencyRange {
  amount: string;
  symbol: string | null;
  symbolPosition: CurrencySymbolPosition;
  usesSymbolSpacing: boolean;
}

/**
 * Intl applies symbol placement according to locale, not currency alone.
 * These overrides select the currency's home-market convention for currencies
 * whose symbols are conventionally displayed after the amount.
 */
const CURRENCY_FORMAT_LOCALES: Readonly<Record<string, string>> = {
  AED: "ar-AE",
  BAM: "bs-BA",
  BGN: "bg-BG",
  BHD: "ar-BH",
  BYN: "be-BY",
  CZK: "cs-CZ",
  DKK: "da-DK",
  EGP: "ar-EG",
  HUF: "hu-HU",
  ILS: "he-IL",
  IQD: "ar-IQ",
  ISK: "is-IS",
  JOD: "ar-JO",
  KWD: "ar-KW",
  NOK: "nb-NO",
  OMR: "ar-OM",
  PLN: "pl-PL",
  QAR: "ar-QA",
  RON: "ro-RO",
  RSD: "sr-RS",
  RUB: "ru-RU",
  SAR: "ar-SA",
  SEK: "sv-SE",
  UAH: "uk-UA",
};

const DEFAULT_CURRENCY_LOCALE = "en-US";

const formatCompactAmount = (amount: number) =>
  Math.abs(amount) >= 1000 ? `${Math.round(amount / 1000)}k` : `${amount}`;

const getCurrencyDisplay = (
  currency: string | null,
): Omit<CompactCurrencyRange, "amount"> => {
  if (!currency) {
    return {
      symbol: null,
      symbolPosition: "prefix",
      usesSymbolSpacing: false,
    };
  }

  try {
    const parts = new Intl.NumberFormat(
      CURRENCY_FORMAT_LOCALES[currency] ?? DEFAULT_CURRENCY_LOCALE,
      {
        currency,
        currencyDisplay: "narrowSymbol",
        style: "currency",
      },
    ).formatToParts(1);
    const currencyIndex = parts.findIndex((part) => part.type === "currency");
    const integerIndex = parts.findIndex((part) => part.type === "integer");
    const firstIndex = Math.min(currencyIndex, integerIndex);
    const lastIndex = Math.max(currencyIndex, integerIndex);

    return {
      symbol:
        parts.find((part) => part.type === "currency")?.value ?? currency,
      symbolPosition: currencyIndex > integerIndex ? "suffix" : "prefix",
      usesSymbolSpacing: parts
        .slice(firstIndex + 1, lastIndex)
        .some(
          (part) => part.type === "literal" && /\s/u.test(part.value),
        ),
    };
  } catch {
    return {
      symbol: currency,
      symbolPosition: "prefix",
      usesSymbolSpacing: true,
    };
  }
};

export const formatCompactCurrencyRange = ({
  currency,
  max,
  min,
}: {
  currency: string | null;
  max: number | null;
  min: number | null;
}): CompactCurrencyRange | null => {
  if (min === null && max === null) return null;

  const firstAmount = min ?? max;
  const lastAmount = max ?? min;
  if (firstAmount === null || lastAmount === null) return null;

  const amount =
    firstAmount === lastAmount
      ? formatCompactAmount(firstAmount)
      : `${formatCompactAmount(firstAmount)}–${formatCompactAmount(lastAmount)}`;

  return {
    amount,
    ...getCurrencyDisplay(currency),
  };
};
