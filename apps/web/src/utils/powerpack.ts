export interface PowerpackStatusWindow {
  shortlistPowerpackActivatedAt?: Date | null;
  shortlistPowerpackExpiresAt?: Date | null;
}

export const hasActivePowerpack = (
  user: PowerpackStatusWindow | null | undefined,
  now = new Date(),
): boolean => {
  if (!user) return false;

  const { shortlistPowerpackActivatedAt, shortlistPowerpackExpiresAt } = user;

  if (!shortlistPowerpackActivatedAt || !shortlistPowerpackExpiresAt) {
    return false;
  }

  return (
    now >= shortlistPowerpackActivatedAt && now <= shortlistPowerpackExpiresAt
  );
};
