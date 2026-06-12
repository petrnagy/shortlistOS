import { t } from "@lingui/core/macro";
import { useState } from "react";

const BoardsSettings = () => {
  const [cardAgingEnabled, setCardAgingEnabled] = useState(true);

  return (
    <div className="space-y-6 py-6">
      <div className="border-b border-light-200 pb-6 dark:border-dark-200">
        <h2 className="mb-4 text-lg font-semibold text-light-1000 dark:text-dark-1000">
          {t`Card Display`}
        </h2>

        <div className="flex items-center justify-between rounded-lg border border-light-200 bg-light-50 p-4 dark:border-dark-200 dark:bg-dark-50">
          <div className="flex-1">
            <h3 className="font-medium text-light-1000 dark:text-dark-1000">
              {t`Card Aging`}
            </h3>
            <p className="mt-1 text-sm text-light-700 dark:text-dark-700">
              {t`Show visual aging effects on cards based on last activity. Cards older than 1 week show progressive aging from faded to parchment style.`}
            </p>
          </div>

          <button
            onClick={() => setCardAgingEnabled(!cardAgingEnabled)}
            className={`ml-4 inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              cardAgingEnabled
                ? "bg-green-600 focus:ring-green-500"
                : "bg-light-300 focus:ring-light-400 dark:bg-dark-300 dark:focus:ring-dark-400"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                cardAgingEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoardsSettings;
