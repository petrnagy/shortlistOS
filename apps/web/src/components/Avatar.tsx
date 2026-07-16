import Image from "next/image";
import { twMerge } from "tailwind-merge";

import { getInitialsFromName, inferInitialsFromEmail } from "~/utils/helpers";

const sizeMap = {
  xs: 20,
  sm: 24,
  md: 36,
  lg: 48,
} as const;

const Avatar = ({
  size = "md",
  name,
  email,
  icon,
  imageUrl,
  isLoading,
}: {
  size?: "xs" | "sm" | "md" | "lg";
  name: string;
  email: string;
  imageUrl?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
}) => {
  const sizePx = sizeMap[size];
  const initials = name?.trim()
    ? getInitialsFromName(name)
    : inferInitialsFromEmail(email);

  return (
    <>
      {imageUrl ? (
        <span
          className="relative inline-flex"
          style={{
            height: sizePx,
            width: icon ? sizePx * 1.8 : sizePx,
          }}
        >
          <Image
            src={imageUrl}
            className="rounded-full bg-gray-50"
            width={sizePx}
            height={sizePx}
            alt=""
          />
          {icon && (
            <span
              className="absolute top-0 flex items-center justify-center rounded-full border border-light-50 bg-light-1000 text-white dark:border-dark-100 dark:bg-dark-400"
              style={{
                height: sizePx,
                left: sizePx * 0.8,
                width: sizePx,
                fontSize: Math.max(11, Math.round(sizePx * 0.56)),
              }}
            >
              {icon}
            </span>
          )}
        </span>
      ) : (
        <span
          className={twMerge(
            "inline-flex h-9 w-9 items-center justify-center rounded-full bg-light-1000 dark:bg-dark-400",
            isLoading && "animate-pulse bg-light-200 dark:bg-dark-200",
            size === "xs" && "h-5 w-5",
            size === "sm" && "h-6 w-6",
            size === "lg" && "h-12 w-12",
          )}
        >
          {icon ? (
            <span className="text-[12px] text-white">{icon}</span>
          ) : (
            <span
              className={twMerge(
                "text-sm font-medium leading-none text-white",
                size === "xs" && "text-[8px]",
                size === "sm" && "text-[10px]",
                size === "lg" && "text-md",
              )}
            >
              {initials}
            </span>
          )}
        </span>
      )}
    </>
  );
};

export default Avatar;
