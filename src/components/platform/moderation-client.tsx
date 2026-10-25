'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { ContentReportItem } from '@/types/domain';

export function ModerationClient({
  initialReports,
  isPlatformAdmin,
}: {
  initialReports: ContentReportItem[];
  isPlatformAdmin: boolean;
}) {
  const router = useRouter();
  const [reports, setReports] = useState<ContentReportItem[]>(initialReports);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleModerate(
    report: ContentReportItem,
    actionType: 'remove_post' | 'dismiss_report' | 'resolve_report'
  ) {
    const targetId =
      report.target_post_id ||
      report.target_comment_id ||
      report.target_user_id ||
      report.id;

    const res = await fetch('/api/moderation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circleId: report.circle_id,
        reportId: report.id,
        actionType,
        targetId,
        reason: `Reviewed via Moderation Queue (${actionType})`,
      }),
    });

    if (res.ok) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, status: actionType === 'dismiss_report' ? 'dismissed' : 'resolved' }
            : r
        )
      );
      setFeedback(`Moderation action "${actionType}" recorded in audit log.`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
            Trust & Safety Governance
          </p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">
            Moderation & Content Reports
          </h1>
          <p className="mt-1 text-xs text-stone-600">
            {isPlatformAdmin
              ? 'Viewing as Platform Administrator across all Circles.'
              : 'Viewing reports for Circles where you hold Moderator, Admin, or Owner privileges.'}
          </p>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{feedback}</span>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-sand-200 bg-white p-12 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-stone-400" />
          <h2 className="mt-3 text-base font-bold text-stone-900">No content reports in queue</h2>
          <p className="mt-1 text-xs text-stone-600">
            Reports submitted by members in Circles you moderate will appear here for review.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-sand-200 rounded-2xl border border-sand-200 bg-white shadow-sm">
          {reports.map((report) => (
            <div key={report.id} className="p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold uppercase text-amber-900">
                    {report.reason.replace('_', ' ')}
                  </span>
                  <span className="font-semibold text-stone-800">
                    Circle: {report.circle_name ?? report.circle_id}
                  </span>
                  <span className="text-stone-400">·</span>
                  <span className="text-stone-500">
                    Reported by {report.reporter_name ?? 'Member'}
                  </span>
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                    report.status === 'open'
                      ? 'bg-red-100 text-red-900'
                      : 'bg-sand-100 text-stone-700'
                  }`}
                >
                  {report.status}
                </span>
              </div>

              {report.target_preview && (
                <div className="rounded-xl bg-sand-50 p-3 text-xs text-stone-800 border border-sand-200">
                  <span className="font-semibold text-stone-600">Reported {report.target_type}: </span>
                  {report.target_preview}
                </div>
              )}

              {report.details && (
                <p className="text-xs text-stone-600">
                  <strong>Reporter details:</strong> {report.details}
                </p>
              )}

              {report.status === 'open' && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {report.target_post_id && (
                    <button
                      type="button"
                      onClick={() => handleModerate(report, 'remove_post')}
                      className="rounded-lg bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                    >
                      Remove Post & Resolve
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleModerate(report, 'resolve_report')}
                    className="rounded-lg bg-forest-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-forest-800"
                  >
                    Mark Resolved
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerate(report, 'dismiss_report')}
                    className="rounded-lg border border-sand-300 px-3.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-sand-100"
                  >
                    Dismiss Report
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
