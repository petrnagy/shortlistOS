const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );

export const connectionBackgroundStyles = `
  .paper-grain { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,.45) 0%, rgba(246,244,239,.25) 100%), #faf9f6; }
  .paper-grain-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.45) 0%, rgba(246,244,239,.25) 100%); }
  .paper-grain svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .paper-grain-multiply { opacity: .28; mix-blend-mode: multiply; }
  .paper-grain-overlay { opacity: .2; mix-blend-mode: overlay; }
  .paper-grain-dark { display: none; opacity: .16; mix-blend-mode: overlay; }
  @media (prefers-color-scheme: dark) { .paper-grain { background: #171717; } .paper-grain::after { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,.85); } .paper-grain-dark { display: block; } }
`;

export const renderConnectionBackground =
  () => `<div class="paper-grain" aria-hidden="true">
  <div class="paper-grain-gradient"></div>
  <svg preserveAspectRatio="none">
    <filter id="paper-grain-noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="5" stitchTiles="stitch"></feTurbulence>
      <feColorMatrix type="saturate" values="0"></feColorMatrix>
      <feComponentTransfer><feFuncR type="linear" slope="2" intercept="-0.45"></feFuncR><feFuncG type="linear" slope="2" intercept="-0.45"></feFuncG><feFuncB type="linear" slope="2" intercept="-0.45"></feFuncB></feComponentTransfer>
    </filter>
    <rect class="paper-grain-multiply" width="100%" height="100%" fill="#6f6248" filter="url(#paper-grain-noise)"></rect>
    <rect class="paper-grain-overlay" width="100%" height="100%" fill="#fffaf0" filter="url(#paper-grain-noise)"></rect>
    <rect class="paper-grain-dark" width="100%" height="100%" fill="#ffffff" filter="url(#paper-grain-noise)"></rect>
  </svg>
</div>`;

interface ConnectionConsentOptions {
  title: string;
  heading: string;
  description: string;
  account?: { label: string; email: string };
  permissions?: string[];
  note?: string;
  form?: {
    action: string;
    fields: Record<string, string>;
    cancel: string;
    allow: string;
    allowValue: string;
  };
  privacy: string;
  link?: { href: string; label: string };
}

// Shared by browser extensions and MCP. Native forms submit once, without hydration.
export function renderConnectionConsent(
  options: ConnectionConsentOptions,
): string {
  const { account, form, link } = options;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f7f5; color: #171717; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; position: relative; background: #faf9f6; }
    ${connectionBackgroundStyles}
    main { position: relative; z-index: 1; width: min(29rem, 100%); padding: 2rem; border: 1px solid #deded9; border-radius: .75rem; background: rgba(255,255,255,.96); box-shadow: 0 18px 45px rgba(23,23,23,.08); }
    .brand { margin: 0 0 1.75rem; font-size: 1rem; font-weight: 750; letter-spacing: -.025em; }
    h1 { margin: 0; font-size: 1.625rem; line-height: 1.2; letter-spacing: -.035em; overflow-wrap: anywhere; }
    .description { margin: .75rem 0 1.5rem; color: #66665f; font-size: .9375rem; line-height: 1.6; }
    .permissions { padding-left: 1.25rem; }
    .permissions li + li { margin-top: .5rem; }
    .account { display: flex; align-items: center; gap: .65rem; margin: 0; padding: .8rem .9rem; border: 1px solid #e5e5e0; border-radius: .5rem; background: #f7f7f5; color: #3f3f3b; font-size: .875rem; overflow-wrap: anywhere; }
    .account::before { content: ""; width: .5rem; height: .5rem; flex: 0 0 auto; border-radius: 999px; background: #22a06b; box-shadow: 0 0 0 3px rgba(34,160,107,.12); }
    .actions { display: flex; gap: .625rem; margin-top: 1.5rem; }
    button { min-height: 2.75rem; flex: 1; border: 1px solid transparent; border-radius: .5rem; padding: .7rem 1rem; font: inherit; font-size: .875rem; font-weight: 700; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, transform .15s ease; }
    button:active { transform: translateY(1px); }
    button:focus-visible, a:focus-visible { outline: 2px solid #171717; outline-offset: 2px; }
    .approve { background: #171717; color: #fff; }
    .approve:hover { background: #30302d; }
    .deny { border-color: #deded9; background: #fff; color: #3f3f3b; }
    .deny:hover { background: #f2f2ef; }
    .privacy { margin: 1.25rem 0 0; color: #85857e; font-size: .75rem; line-height: 1.5; text-align: center; }
    .privacy a { color: inherit; text-underline-offset: 2px; }
    @media (max-width: 32rem) { main { padding: 1.5rem; } .actions { flex-direction: column-reverse; } }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; background: #171717; color: #f5f5f3; }
      body { background-color: #171717; }
      main { border-color: #3b3b38; background: rgba(32,32,30,.97); box-shadow: 0 18px 50px rgba(0,0,0,.3); }
      .description { color: #b7b7b0; }
      .account { border-color: #41413d; background: #292927; color: #deded8; }
      .approve { background: #f4f4f1; color: #171717; }
      .approve:hover { background: #dfdfda; }
      .deny { border-color: #41413d; background: #292927; color: #deded8; }
      .deny:hover { background: #353532; }
      button:focus-visible, a:focus-visible { outline-color: #f4f4f1; }
    }
  </style>
</head>
<body>
  ${renderConnectionBackground()}
  <main>
    <p class="brand">shortlistOS</p>
    <h1>${escapeHtml(options.heading)}</h1>
    <p class="description">${escapeHtml(options.description)}</p>
    ${options.permissions ? `<ul class="description permissions">${options.permissions.map((permission) => `<li>${escapeHtml(permission)}</li>`).join("")}</ul>` : ""}
    ${account ? `<p class="account">${escapeHtml(account.label)} ${escapeHtml(account.email)}</p>` : ""}
    ${
      form
        ? `<form method="post" action="${escapeHtml(form.action)}">
      ${Object.entries(form.fields)
        .map(
          ([name, value]) =>
            `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
        )
        .join("\n      ")}
      <div class="actions">
        <button type="submit" class="deny" name="decision" value="deny">${escapeHtml(form.cancel)}</button>
        <button type="submit" class="approve" name="decision" value="${escapeHtml(form.allowValue)}">${escapeHtml(form.allow)}</button>
      </div>
    </form>`
        : ""
    }
    ${options.note ? `<p class="privacy">${escapeHtml(options.note)}</p>` : ""}
    <p class="privacy">${escapeHtml(options.privacy)}${link ? ` <a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>` : ""}</p>
  </main>
</body>
</html>`;
}
