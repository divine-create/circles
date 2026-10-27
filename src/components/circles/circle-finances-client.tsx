'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building,
  ShieldCheck,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  Circle,
  CommunityTreasuryLedgerItem,
  InvoiceItem,
  MemberEntitlementItem,
  PricingPlanItem,
  TreasurySummary,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CircleFinancesClientProps {
  circle: Circle;
  currentUserId: string | null;
  plans: PricingPlanItem[];
  invoices: InvoiceItem[];
  entitlements: MemberEntitlementItem[];
  treasurySummary: TreasurySummary | null;
  treasuryLedger: CommunityTreasuryLedgerItem[];
}

export function CircleFinancesClient({
  circle,
  currentUserId,
  plans,
  invoices: initialInvoices,
  entitlements: initialEntitlements,
  treasurySummary,
  treasuryLedger,
}: CircleFinancesClientProps) {
  const [tab, setTab] = useState<'plans' | 'invoices' | 'entitlements' | 'treasury'>('plans');
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [entitlements] = useState<MemberEntitlementItem[]>(initialEntitlements);

  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PricingPlanItem | null>(
    null
  );
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<InvoiceItem | null>(null);

  const [donationAmount, setDonationAmount] = useState('25');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showSuccess(msg: string) {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5000);
  }

  async function handleCheckout(plan: PricingPlanItem) {
    if (!currentUserId) {
      window.location.href = `/login?redirect=/circles/${circle.slug}/finances`;
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const amountCents =
        plan.billing_type === 'sliding_scale'
          ? Math.round((parseFloat(donationAmount) || 10) * 100)
          : plan.amount_cents;

      // Initiate invoice
      const res = await fetch(`/api/circles/${circle.id}/finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_invoice',
          invoice: {
            userId: currentUserId,
            planId: plan.id,
            title: plan.name,
            totalCents: amountCents,
            currency: plan.currency,
            paymentMethod: 'bank_transfer',
            status: 'open',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate invoice');

      setInvoices([data.invoice, ...invoices]);
      setSelectedInvoiceToPay(data.invoice);
      setSelectedPlanForCheckout(null);
      setTab('invoices');
      showSuccess(`Invoice ${data.invoice.invoice_number} created! See bank payment instructions.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  const activeEntitlements = entitlements.filter(
    (e) => e.status === 'active' || e.status === 'grace_period'
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-forest-100 p-1.5 text-forest-800">
              <CreditCard className="h-5 w-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
              Finances, Dues & Access Plans
            </h2>
          </div>
          <p className="mt-2 text-sm text-stone-600 max-w-2xl leading-relaxed">
            Manage your community membership dues, access passes, and invoices for {circle.name}.
            Transparent community bookkeeping ensures fiscal accountability for all residents and
            members.
          </p>
        </div>

        {activeEntitlements.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs shrink-0">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Good Standing</span>
            </div>
            <p className="mt-1 text-emerald-700">
              {activeEntitlements.length} active{' '}
              {activeEntitlements.length === 1 ? 'privilege' : 'privileges'} granted.
            </p>
          </div>
        )}
      </div>

      {/* Notifications */}
      {banner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          {banner}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-sm animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => setTab('plans')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            tab === 'plans'
              ? 'bg-forest-900 text-white shadow-sm'
              : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
          }`}
        >
          Community Plans & Tariffs ({plans.length})
        </button>

        {currentUserId && (
          <>
            <button
              onClick={() => setTab('invoices')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                tab === 'invoices'
                  ? 'bg-forest-900 text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              My Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setTab('entitlements')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                tab === 'entitlements'
                  ? 'bg-forest-900 text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              Active Entitlements ({activeEntitlements.length})
            </button>
          </>
        )}

        <button
          onClick={() => setTab('treasury')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            tab === 'treasury'
              ? 'bg-forest-900 text-white shadow-sm'
              : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
          }`}
        >
          Community Treasury & Transparency
        </button>
      </div>

      {/* TAB 1: PLANS & TARIFFS */}
      {tab === 'plans' && (
        <div className="space-y-6">
          {plans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 p-12 text-center bg-white">
              <CreditCard className="mx-auto h-10 w-10 text-stone-400" />
              <h3 className="mt-3 text-base font-semibold text-stone-900">No active plans</h3>
              <p className="mt-1 text-sm text-stone-500">
                The community administrators have not published active billing plans yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-sm hover:border-forest-600 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-stone-900">{plan.name}</h3>
                      <Badge variant="outline">{plan.billing_type.replace('_', ' ')}</Badge>
                    </div>

                    <p className="mt-3 text-sm text-stone-600 line-clamp-3">
                      {plan.description || 'Community service assessment or membership plan.'}
                    </p>

                    <div className="mt-5 flex items-baseline gap-1">
                      {plan.billing_type === 'sliding_scale' ? (
                        <div>
                          <span className="text-2xl font-extrabold text-stone-900">
                            From ${(plan.min_amount_cents ? plan.min_amount_cents / 100 : 0).toFixed(2)}
                          </span>
                          <span className="text-xs text-stone-500 block mt-0.5">
                            Pay what you wish
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-stone-900">
                            ${(plan.amount_cents / 100).toFixed(2)}
                          </span>
                          <span className="text-xs text-stone-500 font-medium">
                            {plan.billing_type === 'recurring' && plan.interval_unit
                              ? ` / ${plan.interval_unit}`
                              : plan.billing_type === 'installments'
                              ? ` (${plan.installment_count}x installments)`
                              : ''}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Entitlements list */}
                    <div className="mt-6 border-t border-stone-100 pt-4 space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Included Privileges:
                      </span>
                      <ul className="space-y-1.5 text-xs text-stone-700">
                        {plan.entitlements?.map((ent) => (
                          <li key={ent.id} className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-forest-700 shrink-0" />
                            <span>
                              {ent.target_type === 'circle_membership' && 'Active Circle Membership'}
                              {ent.target_type === 'space_access' && 'Private Space Access'}
                              {ent.target_type === 'course_access' && 'Course Curriculum Enrollment'}
                              {ent.target_type === 'resource_quota' &&
                                `${ent.quota_quantity || 10} Hours Facility / Court Credits`}
                              {ent.target_type === 'badge_grant' && 'Verified Community Badge'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-stone-100">
                    <Button
                      onClick={() => {
                        if (plan.billing_type === 'sliding_scale') {
                          setSelectedPlanForCheckout(plan);
                        } else {
                          handleCheckout(plan);
                        }
                      }}
                      disabled={busy}
                      className="w-full"
                    >
                      {plan.billing_type === 'sliding_scale'
                        ? 'Contribute'
                        : plan.billing_type === 'recurring'
                        ? 'Subscribe / Pay Dues'
                        : 'Select Plan'}
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY INVOICES */}
      {tab === 'invoices' && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          {invoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-stone-400" />
              <h3 className="mt-3 text-base font-semibold text-stone-900">
                No invoices on record
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                You currently have no outstanding or historical invoices in this community.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="px-6 py-4">Invoice #</th>
                    <th className="px-6 py-4">Title / Assessment</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-stone-50/50">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-stone-900">
                        {inv.invoice_number}
                      </td>
                      <td className="px-6 py-4 font-medium text-stone-800">{inv.title}</td>
                      <td className="px-6 py-4 font-bold text-stone-900">
                        ${(inv.total_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-xs text-stone-500">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'Upon receipt'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'open'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {inv.status === 'open' ? (
                          <Button
                            onClick={() => setSelectedInvoiceToPay(inv)}
                            size="xs"
                            variant="primary"
                          >
                            Pay / Wire Instructions
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE ENTITLEMENTS */}
      {tab === 'entitlements' && (
        <div className="space-y-4">
          {activeEntitlements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 p-12 text-center bg-white">
              <ShieldCheck className="mx-auto h-10 w-10 text-stone-400" />
              <h3 className="mt-3 text-base font-semibold text-stone-900">
                No active privileges on record
              </h3>
              <p className="mt-1 text-sm text-stone-500 max-w-md mx-auto">
                Pay your dues or subscribe to a plan to unlock gated spaces, courses, or facility
                credits.
              </p>
              <Button onClick={() => setTab('plans')} className="mt-5" size="sm">
                View Available Plans
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeEntitlements.map((ent) => (
                <div
                  key={ent.id}
                  className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <h4 className="font-bold text-stone-900 capitalize">
                      {ent.target_type.replace('_', ' ')}
                    </h4>
                  </div>

                  <p className="mt-2 text-xs text-stone-600">
                    Target ID: <span className="font-mono text-stone-800">{ent.target_id || 'Global Circle'}</span>
                  </p>

                  {ent.remaining_quota !== null && ent.remaining_quota !== undefined && (
                    <div className="mt-3 rounded-xl bg-stone-50 p-2.5 border border-stone-200 text-xs">
                      <span className="text-stone-500">Remaining Balance:</span>{' '}
                      <span className="font-bold text-stone-900">{ent.remaining_quota} credits</span>
                    </div>
                  )}

                  <div className="mt-4 border-t border-stone-100 pt-3 text-[11px] text-stone-400 flex items-center justify-between">
                    <span>Active status</span>
                    <span>Granted: {new Date(ent.granted_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMMUNITY TREASURY TRANSPARENCY */}
      {tab === 'treasury' && (
        <div className="space-y-6">
          {/* Balance Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Total Member Contributions
              </span>
              <div className="mt-2 text-2xl font-bold text-emerald-700">
                ${(((treasurySummary?.total_revenue_cents || 0) / 100)).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Community Maintenance & Expenses
              </span>
              <div className="mt-2 text-2xl font-bold text-red-700">
                ${(((treasurySummary?.total_expense_cents || 0) / 100)).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Reserve Balance
              </span>
              <div
                className={`mt-2 text-2xl font-bold ${
                  (treasurySummary?.net_balance_cents || 0) >= 0 ? 'text-forest-800' : 'text-red-700'
                }`}
              >
                ${(((treasurySummary?.net_balance_cents || 0) / 100)).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-stone-200 bg-stone-50 px-6 py-4">
              <h3 className="text-sm font-bold text-stone-900">
                Public Community Treasury Ledger
              </h3>
              <p className="mt-0.5 text-xs text-stone-500">
                Real-time financial disclosures for all community maintenance and assessment
                inflows.
              </p>
            </div>

            {treasuryLedger.length === 0 ? (
              <div className="p-10 text-center text-sm text-stone-500">
                No public ledger entries recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-stone-600">
                  <thead className="bg-stone-50/50 text-xs font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                    <tr>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Category</th>
                      <th className="px-6 py-3.5">Description</th>
                      <th className="px-6 py-3.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {treasuryLedger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-stone-50/50">
                        <td className="px-6 py-4 text-xs font-mono text-stone-500">
                          {new Date(entry.entry_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 capitalize font-medium text-stone-800">
                          {entry.category}
                        </td>
                        <td className="px-6 py-4 font-normal text-stone-900 max-w-md">
                          {entry.description}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-bold font-mono ${
                            entry.entry_type === 'revenue' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {entry.entry_type === 'revenue' ? '+' : '-'}$
                          {(entry.amount_cents / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SLIDING SCALE / DONATION PROMPT */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">{selectedPlanForCheckout.name}</h3>
            <p className="mt-1 text-sm text-stone-500">
              {selectedPlanForCheckout.description ||
                'Enter the amount you would like to contribute.'}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Contribution Amount ($ USD)
                </label>
                <input
                  type="number"
                  min={(selectedPlanForCheckout.min_amount_cents || 0) / 100}
                  step="1"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-base font-bold focus:border-forest-600 focus:outline-none"
                />
              </div>

              {selectedPlanForCheckout.suggested_amounts_cents && (
                <div className="flex gap-2">
                  {selectedPlanForCheckout.suggested_amounts_cents.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDonationAmount((s / 100).toString())}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold hover:border-forest-600"
                    >
                      ${(s / 100).toFixed(0)}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPlanForCheckout(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleCheckout(selectedPlanForCheckout)}
                  disabled={busy}
                >
                  Confirm & Generate Invoice
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WIRE / PAYMENT INSTRUCTIONS */}
      {selectedInvoiceToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Payment Instructions</h3>
                <p className="text-xs text-stone-500 font-mono">
                  Invoice #{selectedInvoiceToPay.invoice_number}
                </p>
              </div>
              <Badge variant="outline">${(selectedInvoiceToPay.total_cents / 100).toFixed(2)}</Badge>
            </div>

            <div className="mt-5 space-y-4 text-xs text-stone-700">
              <div className="rounded-xl bg-forest-50 border border-forest-200 p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-forest-900">
                  <Building className="h-4 w-4" />
                  <span>Direct Bank Wire / Transfer</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-stone-700 pt-1">
                  <div>
                    <span className="text-stone-500 block">Beneficiary:</span>
                    <span className="font-semibold">{circle.name} Community Fund</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Bank:</span>
                    <span className="font-semibold">Citibank N.A.</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Routing / Sort Code:</span>
                    <span className="font-mono font-semibold">021000089</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Account Number:</span>
                    <span className="font-mono font-semibold">4499-1029-3882</span>
                  </div>
                </div>

                <div className="border-t border-forest-200/80 pt-2 text-[11px] text-forest-800">
                  <span className="font-bold">Required Reference: </span>
                  Please quote{' '}
                  <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-forest-300">
                    {selectedInvoiceToPay.invoice_number}
                  </span>{' '}
                  on your wire description so the treasurer can automatically match and activate your
                  privileges.
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                <p className="text-stone-500 leading-relaxed">
                  Once your transfer is received, the Circle administrator will reconcile the payment
                  and your entitlements will immediately become active.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setSelectedInvoiceToPay(null)}>Close Instructions</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
