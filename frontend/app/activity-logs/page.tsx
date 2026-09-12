import { ActivityLogsPage } from '@/components/activity-logs/activity-logs-page';

export const metadata = {
  title: 'Activity & Audit Log | MS Karim Traders',
  description: 'Real-time activity and audit trail of all transactions and dispatches',
};

export default function ActivityLogsRoute() {
  return <ActivityLogsPage />;
}
