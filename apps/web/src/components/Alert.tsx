import type { IconType } from "react-icons";
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiInformationCircle,
  HiXCircle,
} from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

type AlertVariant = "success" | "danger" | "info" | "warning";

interface AlertProps {
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title?: string;
  variant?: AlertVariant;
}

const variantStyles: Record<
  AlertVariant,
  {
    container: string;
    icon: string;
    Icon: IconType;
  }
> = {
  success: {
    container:
      "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100",
    icon: "text-brand-600 dark:text-brand-400",
    Icon: HiCheckCircle,
  },
  danger: {
    container:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100",
    icon: "text-red-600 dark:text-red-400",
    Icon: HiXCircle,
  },
  info: {
    container:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100",
    icon: "text-sky-600 dark:text-sky-400",
    Icon: HiInformationCircle,
  },
  warning: {
    container:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: HiExclamationTriangle,
  },
};

export function Alert({
  actions,
  children,
  className,
  title,
  variant = "info",
}: AlertProps) {
  const styles = variantStyles[variant];
  const Icon = styles.Icon;

  return (
    <div
      className={twMerge(
        "rounded-lg border px-5 py-4",
        styles.container,
        className,
      )}
    >
      <div className="flex gap-3">
        <Icon
          className={twMerge("mt-0.5 h-5 w-5 flex-none", styles.icon)}
          aria-hidden="true"
        />
        <div>
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          <div className={twMerge("text-sm leading-6", title && "mt-2")}>
            {children}
          </div>
          {actions ? <div className="mt-4 flex gap-4">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
