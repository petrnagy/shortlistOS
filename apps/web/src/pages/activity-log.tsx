import type { NextPageWithLayout } from "~/pages/_app";
import { getDashboardLayout } from "~/components/Dashboard";
import ActivityLog from "~/views/activity-log";

const ActivityLogPage: NextPageWithLayout = () => {
  return <ActivityLog />;
};

ActivityLogPage.getLayout = (page) => getDashboardLayout(page);

export default ActivityLogPage;
