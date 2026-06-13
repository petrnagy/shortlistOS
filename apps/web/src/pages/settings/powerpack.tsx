import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import { SettingsLayout } from "~/components/SettingsLayout";
import PowerpackSettings from "~/views/settings/PowerpackSettings";

const PowerpackSettingsPage: NextPageWithLayout = () => {
  return (
    <SettingsLayout currentTab="powerpack">
      <PowerpackSettings />
    </SettingsLayout>
  );
};

PowerpackSettingsPage.getLayout = (page) => getDashboardLayout(page);

export default PowerpackSettingsPage;
