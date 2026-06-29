const PaperGrainBackground = () => (
  <div
    className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden"
    style={{
      background:
        "linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(246, 244, 239, 0.25) 100%), #faf9f6",
    }}
  >
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(246, 244, 239, 0.25) 100%)",
      }}
    />
    <svg
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <filter id="paper-grain-noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="5"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="2" intercept="-0.45" />
          <feFuncG type="linear" slope="2" intercept="-0.45" />
          <feFuncB type="linear" slope="2" intercept="-0.45" />
        </feComponentTransfer>
      </filter>
      <rect
        width="100%"
        height="100%"
        fill="#6f6248"
        filter="url(#paper-grain-noise)"
        opacity="0.28"
        style={{ mixBlendMode: "multiply" }}
      />
      <rect
        width="100%"
        height="100%"
        fill="#fffaf0"
        filter="url(#paper-grain-noise)"
        opacity="0.2"
        style={{ mixBlendMode: "overlay" }}
      />
    </svg>
    <div className="absolute inset-0 hidden bg-[rgba(0,0,0,0.85)] dark:block" />
    <svg
      className="absolute inset-0 hidden h-full w-full dark:block"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect
        width="100%"
        height="100%"
        fill="#ffffff"
        filter="url(#paper-grain-noise)"
        opacity="0.16"
        style={{ mixBlendMode: "overlay" }}
      />
    </svg>
  </div>
);

export default PaperGrainBackground;
