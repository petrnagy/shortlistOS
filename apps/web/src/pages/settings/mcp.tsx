import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import { SettingsLayout } from "~/components/SettingsLayout";
import McpSettings from "~/views/settings/McpSettings";

const McpSettingsPage: NextPageWithLayout = () => (
  <SettingsLayout currentTab="mcp">
    <McpSettings />
  </SettingsLayout>
);
McpSettingsPage.getLayout = (page) => getDashboardLayout(page);
export default McpSettingsPage;
