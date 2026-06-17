import type { ReactNode } from "react";

const Badge = ({
  value,
  iconLeft,
  size = "xs",
}: {
  value: string;
  iconLeft: ReactNode;
  size?: "xs" | "sm";
}) => (
  <span
    className={`mt-1 inline-flex w-fit items-center gap-x-1.5 rounded-full px-3 py-1 font-medium text-neutral-600 ring-1 ring-inset ring-light-600 dark:text-dark-1000 dark:ring-dark-800 ${size === "sm" ? "text-sm" : "text-[10px]"}`}
  >
    {iconLeft}
    <div>{value}</div>
  </span>
);

export default Badge;
