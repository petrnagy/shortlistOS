import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import { SettingsLayout } from "~/components/SettingsLayout";
import BoardsSettings from "~/views/settings/BoardsSettings";
import Popup from "~/components/Popup";

const BoardsSettingsPage: NextPageWithLayout = () => {
  return (
    <SettingsLayout currentTab="boards">
      <BoardsSettings />
      <Popup />
    </SettingsLayout>
  );
};

BoardsSettingsPage.getLayout = (page) => getDashboardLayout(page);

export default BoardsSettingsPage;
