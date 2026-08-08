export const isMagicLinkSignUpUrl = (url: string): boolean =>
  new URL(url).searchParams.has("newUserCallbackURL");
