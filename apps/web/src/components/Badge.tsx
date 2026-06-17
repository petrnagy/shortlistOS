import type { ReactNode } from "react";

const Badge = ({
  value,
  iconLeft,
  size = "xs",
  padding = "sm",
}: {
  value: string;
  iconLeft: ReactNode;
  size?: "xs" | "sm";
  padding?: "sm" | "md";
}) => (
  <span
    className={`mt-1 inline-flex w-fit items-center gap-x-1.5 rounded-full py-1 font-medium text-neutral-600 ring-1 ring-inset ring-light-600 dark:text-dark-1000 dark:ring-dark-800 ${padding === "md" ? "px-3" : "px-2"} ${size === "sm" ? "text-sm" : "text-[10px]"}`}
  >
    {iconLeft}
    <div>{value}</div>
  </span>
);

export default Badge;
