import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";

const IconBolt = ({ className }: { className?: string }) => {
  const [animationDelay, setAnimationDelay] = useState("0s");
  const boltMask =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' fill-rule='evenodd' clip-rule='evenodd' d='M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z'/></svg>\")";

  useEffect(() => {
    setAnimationDelay(`-${(Math.random() * 6).toFixed(2)}s`);
  }, []);

  return (
    <span
      aria-hidden="true"
      className={twMerge(
        "relative inline-flex h-4 w-4 shrink-0 items-center justify-center align-middle leading-none",
        className,
      )}
    >
      <span
        className="bolt-steam absolute inset-0"
        style={{
          background:
            "linear-gradient(-45deg, #06B6D4, #e73c7e, #ee7752, #10B981)",
          backgroundSize: "400% 400%",
          animationDelay,
          WebkitMaskImage: boltMask,
          maskImage: boltMask,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
      <style jsx>{`
        .bolt-steam {
          animation: gradient 6s ease infinite;
        }

        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }

          50% {
            background-position: 100% 50%;
          }

          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </span>
  );
};

export default IconBolt;
