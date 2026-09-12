'use client';

import dynamic from 'next/dynamic';

const ActivityLogsPage = dynamic(
  () =>
    import('@/components/activity-logs/activity-logs-page').then(
      (mod) => mod.ActivityLogsPage
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>অ্যাক্টিভিটি ও অডিট লগ লোড হচ্ছে...</span>
        </div>
      </div>
    ),
  }
);

export default function ActivityLogsRoute() {
  return <ActivityLogsPage />;
}
