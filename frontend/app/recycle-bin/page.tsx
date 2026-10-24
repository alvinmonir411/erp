'use client';

import dynamic from 'next/dynamic';

const RecycleBinPage = dynamic(
  () =>
    import('@/components/recycle-bin/recycle-bin-page').then(
      (mod) => mod.RecycleBinPage
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>রিসাইকেল বিন লোড হচ্ছে...</span>
        </div>
      </div>
    ),
  }
);

export default function RecycleBinRoute() {
  return <RecycleBinPage />;
}
