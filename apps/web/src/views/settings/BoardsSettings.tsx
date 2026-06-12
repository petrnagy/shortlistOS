import { t } from "@lingui/core/macro";
import { useState } from "react";

import Toggle from "~/components/Toggle";

const BoardsSettings = () => {
  const [cardAgingEnabled, setCardAgingEnabled] = useState(true);

  return (
    <div className="mb-8 border-t border-light-300 dark:border-dark-300">
      <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
        {t`Card Aging`}
      </h2>
      <p className="mb-8 text-sm text-neutral-500 dark:text-dark-900">
        {t`Show visual aging effects on cards based on last activity. Cards older than 1 week show progressive aging from faded to parchment style.`}
      </p>
      <div className="flex items-center gap-3">
        <Toggle
          isChecked={cardAgingEnabled}
          onChange={() => setCardAgingEnabled(!cardAgingEnabled)}
          label={t`Card Aging`}
          showLabel={false}
        />
        <span className="text-sm text-neutral-700 dark:text-dark-900">
          {cardAgingEnabled ? t`Enabled` : t`Disabled`}
        </span>
      </div>
    </div>
  );
};

export default BoardsSettings;
