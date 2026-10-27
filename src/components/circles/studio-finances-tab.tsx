'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building,
  Layers,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  BillingType,
  Circle,
  CircleMembership,
  CircleSpace,
  CommunityTreasuryLedgerItem,
  EntitlementTargetType,
  InvoiceItem,
  PaymentMethod,
  PricingPlanItem,
  TreasuryCategory,
  TreasurySummary,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StudioFinancesTabProps {
  circle: Circle;
  spaces: CircleSpace[];
  members: CircleMembership[];
}

export function StudioFinancesTab({
  circle,
  spaces,
  members,
}: StudioFinancesTabProps) {
  const [subTab, setSubTab] = useState<'plans' | 'invoices' | 'treasury'>('plans');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [plans, setPlans] = useState<PricingPlanItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [treasuryLedger, setTreasuryLedger] = useState<CommunityTreasuryLedgerItem[]>([]);
  const [treasurySummary, setTreasurySummary] = useState<TreasurySummary | null>(null);

  // Modals state
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState<InvoiceItem | null>(null);
  const [showTreasuryModal, setShowTreasuryModal] = useState(false);

  // Create Plan Form state
  const [planName, setPlanName] = useState('');
  const [planSlug, setPlanSlug] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planBillingType, setPlanBillingType] = useState<BillingType>('recurring');
  const [planAmount, setPlanAmount] = useState('75');
  const [planCurrency] = useState('USD');
  const [planIntervalUnit, setPlanIntervalUnit] = useState<'month' | 'quarter' | 'year'>('month');
  const [planInstallmentCount, setPlanInstallmentCount] = useState('3');
  const [planMinAmount, setPlanMinAmount] = useState('10');
  const [planQuotaQuantity, setPlanQuotaQuantity] = useState('10');
  const [planEntitlements, setPlanEntitlements] = useState<
    Array<{ targetType: EntitlementTargetType; targetId?: string; quotaQuantity?: number }>
  >([{ targetType: 'circle_membership' }]);

  // Create Invoice Form state
  const [invUserId, setInvUserId] = useState(members[0]?.user_id || '');
  const [invPlanId, setInvPlanId] = useState('');
  const [invTitle, setInvTitle] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invDueDate, setInvDueDate] = useState('');
  const [invNotes, setInvNotes] = useState('');

  // Reconcile Payment Form state
  const [recMethod, setRecMethod] = useState<PaymentMethod>('bank_transfer');
  const [recRef, setRecRef] = useState('');
  const [recNotes, setRecNotes] = useState('');
  const [recRecordTreasury, setRecRecordTreasury] = useState(true);
  const [recCategory, setRecCategory] = useState<TreasuryCategory>('dues');

  // Treasury Entry Form state
  const [trType, setTrType] = useState<'revenue' | 'expense'>('expense');
  const [trCategory, setTrCategory] = useState<TreasuryCategory>('maintenance');
  const [trAmount, setTrAmount] = useState('350');
  const [trDescription, setTrDescription] = useState('');
  const [trIsPublic, setTrIsPublic] = useState(true);

  const [saving, setSaving] = useState(false);

  function showSuccess(msg: string) {
    setBanner(msg);
    setTimeout(() => setBanner(null), 4000);
  }

  const loadAllFinancialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, invsRes, ledgerRes, summaryRes] = await Promise.all([
        fetch(`/api/circles/${circle.id}/finances?mode=plans&includeInactive=true`).then((r) =>
          r.json()
        ),
        fetch(`/api/circles/${circle.id}/finances?mode=invoices`).then((r) => r.json()),
        fetch(`/api/circles/${circle.id}/finances?mode=treasury_ledger`).then((r) => r.json()),
        fetch(`/api/circles/${circle.id}/finances?mode=treasury_summary`).then((r) => r.json()),
      ]);

      if (plansRes.error) throw new Error(plansRes.error);
      if (invsRes.error) throw new Error(invsRes.error);

      setPlans(plansRes.plans || []);
      setInvoices(invsRes.invoices || []);
      setTreasuryLedger(ledgerRes.ledger || []);
      setTreasurySummary(summaryRes.summary || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load finances';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [circle.id]);

  useEffect(() => {
    loadAllFinancialData();
  }, [loadAllFinancialData]);

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const amountCents = Math.round((parseFloat(planAmount) || 0) * 100);
      const minAmountCents =
        planBillingType === 'sliding_scale'
          ? Math.round((parseFloat(planMinAmount) || 0) * 100)
          : undefined;

      const formattedEntitlements = planEntitlements.map((ent) => ({
        targetType: ent.targetType,
        targetId: ent.targetId || undefined,
        quotaQuantity:
          ent.targetType === 'resource_quota' ? parseInt(planQuotaQuantity, 10) || 10 : undefined,
      }));

      const res = await fetch(`/api/circles/${circle.id}/finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_plan',
          plan: {
            name: planName,
            slug: planSlug || planName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: planDescription,
            billingType: planBillingType,
            amountCents,
            currency: planCurrency,
            intervalUnit: planBillingType === 'recurring' ? planIntervalUnit : undefined,
            installmentCount:
              planBillingType === 'installments'
                ? parseInt(planInstallmentCount, 10) || 3
                : undefined,
            minAmountCents,
            suggestedAmountsCents:
              planBillingType === 'sliding_scale' ? [1000, 2500, 5000, 10000] : [],
            entitlements: formattedEntitlements,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create plan');

      showSuccess(`Plan "${data.plan.name}" created successfully.`);
      setShowCreatePlanModal(false);
      resetPlanForm();
      loadAllFinancialData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating plan');
    } finally {
      setSaving(false);
    }
  }

  function resetPlanForm() {
    setPlanName('');
    setPlanSlug('');
    setPlanDescription('');
    setPlanAmount('75');
    setPlanBillingType('recurring');
    setPlanEntitlements([{ targetType: 'circle_membership' }]);
  }

  async function handleTogglePlan(plan: PricingPlanItem) {
    try {
      const res = await fetch(`/api/circles/${circle.id}/finances`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_plan',
          planId: plan.id,
          updates: { isActive: !plan.is_active },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update plan');

      showSuccess(`Plan ${plan.name} status updated.`);
      loadAllFinancialData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating plan');
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const totalCents = Math.round((parseFloat(invAmount) || 0) * 100);

      const res = await fetch(`/api/circles/${circle.id}/finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_invoice',
          invoice: {
            userId: invUserId,
            planId: invPlanId || undefined,
            title: invTitle,
            totalCents,
            currency: 'USD',
            dueDate: invDueDate ? new Date(invDueDate).toISOString() : undefined,
            notes: invNotes,
            status: 'open',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue invoice');

      showSuccess(`Invoice ${data.invoice.invoice_number} issued to member.`);
      setShowCreateInvoiceModal(false);
      loadAllFinancialData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating invoice');
    } finally {
      setSaving(false);
    }
  }

  async function handleReconcilePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!showReconcileModal) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_offline_payment',
          payment: {
            invoiceId: showReconcileModal.id,
            paymentMethod: recMethod,
            paymentReference: recRef,
            notes: recNotes,
            recordInTreasury: recRecordTreasury,
            treasuryCategory: recCategory,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reconcile payment');

      showSuccess(
        `Payment recorded! ${data.entitlementsGranted?.length || 0} entitlements activated for member.`
      );
      setShowReconcileModal(null);
      setRecRef('');
      setRecNotes('');
      loadAllFinancialData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error recording payment');
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordTreasuryEntry(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const amountCents = Math.round((parseFloat(trAmount) || 0) * 100);

      const res = await fetch(`/api/circles/${circle.id}/finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_treasury_entry',
          entry: {
            entryType: trType,
            category: trCategory,
            amountCents,
            currency: 'USD',
            description: trDescription,
            isPublicToMembers: trIsPublic,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record entry');

      showSuccess('Treasury ledger entry recorded.');
      setShowTreasuryModal(false);
      setTrDescription('');
      loadAllFinancialData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error recording entry');
    } finally {
      setSaving(false);
    }
  }

  const openInvoicesCount = invoices.filter((i) => i.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Top Notification Banners */}
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

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Active Plans
            </span>
            <div className="rounded-xl bg-forest-50 p-2 text-forest-700">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900">
              {plans.filter((p) => p.is_active).length}
            </span>
            <span className="text-xs text-stone-500">tariffs</span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Open Invoices
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700">{openInvoicesCount}</span>
            <span className="text-xs text-stone-500">unpaid dues</span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Treasury Revenue
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-800">
              ${(((treasurySummary?.total_revenue_cents || 0) / 100)).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Net Balance
            </span>
            <div className="rounded-xl bg-stone-100 p-2 text-stone-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                (treasurySummary?.net_balance_cents || 0) >= 0 ? 'text-forest-800' : 'text-red-700'
              }`}
            >
              ${(((treasurySummary?.net_balance_cents || 0) / 100)).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-xs text-stone-500">{circle.name} fund</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs & Actions Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('plans')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              subTab === 'plans'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Tariffs & Pricing Plans ({plans.length})
          </button>
          <button
            onClick={() => setSubTab('invoices')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              subTab === 'invoices'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Invoices & Dues ({invoices.length})
          </button>
          <button
            onClick={() => setSubTab('treasury')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              subTab === 'treasury'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Community Treasury Ledger ({treasuryLedger.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'plans' && (
            <Button
              onClick={() => {
                resetPlanForm();
                setShowCreatePlanModal(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Pricing Plan
            </Button>
          )}
          {subTab === 'invoices' && (
            <Button
              onClick={() => {
                setInvTitle('');
                setInvAmount('');
                setShowCreateInvoiceModal(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Issue Dues Invoice
            </Button>
          )}
          {subTab === 'treasury' && (
            <Button
              onClick={() => {
                setTrDescription('');
                setShowTreasuryModal(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Record Entry
            </Button>
          )}
          <button
            onClick={loadAllFinancialData}
            title="Refresh finances"
            className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PRICING PLANS */}
      {subTab === 'plans' && (
        <div className="space-y-4">
          {plans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 p-12 text-center bg-stone-50/50">
              <CreditCard className="mx-auto h-10 w-10 text-stone-400" />
              <h3 className="mt-3 text-base font-semibold text-stone-900">
                No pricing plans configured yet
              </h3>
              <p className="mt-1 text-sm text-stone-500 max-w-md mx-auto">
                Set up recurring membership levies, facility passes, or flexible donation tiers for
                your community.
              </p>
              <Button onClick={() => setShowCreatePlanModal(true)} className="mt-5" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create First Plan
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                    plan.is_active
                      ? 'border-stone-200 bg-white shadow-sm'
                      : 'border-stone-200 bg-stone-50/70 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-base font-bold text-stone-900">{plan.name}</h4>
                      <Badge
                        variant={
                          plan.billing_type === 'recurring'
                            ? 'dark'
                            : plan.billing_type === 'metered_pack'
                            ? 'blue'
                            : 'outline'
                        }
                      >
                        {plan.billing_type.replace('_', ' ')}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs text-stone-600 line-clamp-2">
                      {plan.description || 'No description provided.'}
                    </p>

                    <div className="mt-4 flex items-baseline gap-1">
                      {plan.billing_type === 'sliding_scale' ? (
                        <span className="text-xl font-bold text-stone-900">
                          From ${(plan.min_amount_cents ? plan.min_amount_cents / 100 : 0).toFixed(2)}
                        </span>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-stone-900">
                            ${(plan.amount_cents / 100).toFixed(2)}
                          </span>
                          <span className="text-xs text-stone-500">
                            {plan.billing_type === 'recurring' && plan.interval_unit
                              ? `/${plan.interval_unit}`
                              : plan.billing_type === 'installments'
                              ? `(${plan.installment_count}x installments)`
                              : ''}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Entitlements preview */}
                    <div className="mt-4 border-t border-stone-100 pt-3">
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                        Unlocks ({plan.entitlements?.length || 0})
                      </span>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {plan.entitlements?.map((ent) => (
                          <span
                            key={ent.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700"
                          >
                            <ShieldCheck className="h-3 w-3 text-forest-700" />
                            {ent.target_type.replace('_', ' ')}
                            {ent.quota_quantity ? ` (${ent.quota_quantity} credits)` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
                    <span className="text-stone-400">/{plan.slug}</span>
                    <button
                      onClick={() => handleTogglePlan(plan)}
                      className={`font-semibold transition-colors ${
                        plan.is_active ? 'text-amber-700 hover:underline' : 'text-forest-700 hover:underline'
                      }`}
                    >
                      {plan.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: INVOICES & RECONCILIATION */}
      {subTab === 'invoices' && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          {invoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-stone-400" />
              <h3 className="mt-3 text-base font-semibold text-stone-900">No invoices issued</h3>
              <p className="mt-1 text-sm text-stone-500">
                Issue dues invoices or fee assessments to community members.
              </p>
              <Button onClick={() => setShowCreateInvoiceModal(true)} className="mt-5" size="sm">
                Issue Invoice
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="px-5 py-3.5">Invoice #</th>
                    <th className="px-5 py-3.5">Member</th>
                    <th className="px-5 py-3.5">Title / Plan</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Reference / Notes</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs font-medium text-stone-900">
                        {inv.invoice_number}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-stone-900">
                          {inv.user_display_name || 'Member'}
                        </div>
                        <div className="text-xs text-stone-400">@{inv.user_username || 'user'}</div>
                      </td>
                      <td className="px-5 py-4 font-medium text-stone-800">{inv.title}</td>
                      <td className="px-5 py-4 font-bold text-stone-900">
                        ${(inv.total_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-5 py-4">
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
                      <td className="px-5 py-4 text-xs text-stone-500 max-w-xs truncate">
                        {inv.payment_reference ? `Ref: ${inv.payment_reference}` : inv.notes || '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {inv.status === 'open' ? (
                          <Button
                            onClick={() => {
                              setShowReconcileModal(inv);
                              setRecRef('');
                              setRecNotes('');
                            }}
                            size="xs"
                            variant="secondary"
                          >
                            Record Payment
                          </Button>
                        ) : (
                          <span className="text-xs text-stone-400">Settled</span>
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

      {/* SUB-TAB 3: COMMUNITY TREASURY LEDGER */}
      {subTab === 'treasury' && (
        <div className="space-y-6">
          {/* Category breakdown chips */}
          {treasurySummary && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                Ledger Allocations by Category
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(treasurySummary.category_breakdown).map(([cat, amount]) => (
                  <div
                    key={cat}
                    className="flex items-center gap-2 rounded-xl bg-stone-50 border border-stone-200/80 px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium capitalize text-stone-700">{cat}:</span>
                    <span className="font-bold text-stone-900">
                      ${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
            {treasuryLedger.length === 0 ? (
              <div className="p-12 text-center">
                <Building className="mx-auto h-10 w-10 text-stone-400" />
                <h3 className="mt-3 text-base font-semibold text-stone-900">
                  Treasury ledger is empty
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  Track maintenance bills, security costs, and member fee receipts transparently.
                </p>
                <Button onClick={() => setShowTreasuryModal(true)} className="mt-5" size="sm">
                  Record Entry
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-stone-600">
                  <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5">Description</th>
                      <th className="px-5 py-3.5">Visibility</th>
                      <th className="px-5 py-3.5">Recorded By</th>
                      <th className="px-5 py-3.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {treasuryLedger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="px-5 py-4 text-xs font-mono text-stone-500 whitespace-nowrap">
                          {new Date(entry.entry_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                              entry.entry_type === 'revenue'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {entry.entry_type === 'revenue' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {entry.entry_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 capitalize font-medium text-stone-700">
                          {entry.category}
                        </td>
                        <td className="px-5 py-4 font-medium text-stone-900 max-w-sm truncate">
                          {entry.description}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {entry.is_public_to_members ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Eye className="h-3 w-3" /> Public
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-stone-400">
                              <EyeOff className="h-3 w-3" /> Private
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-stone-500">
                          {entry.recorded_by_name || 'Admin'}
                        </td>
                        <td
                          className={`px-5 py-4 text-right font-bold font-mono ${
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

      {/* MODAL 1: CREATE PRICING PLAN */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-900">Create New Pricing Plan</h3>
            <p className="mt-1 text-sm text-stone-500">
              Configure a hyper-customized billing plan with composable access entitlements.
            </p>

            <form onSubmit={handleCreatePlan} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Plan Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Estate Dues / Tennis Pass / 3-Month Tuition"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Billing Archetype
                </label>
                <select
                  value={planBillingType}
                  onChange={(e) => setPlanBillingType(e.target.value as BillingType)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                >
                  <option value="recurring">Recurring (Monthly / Quarterly / Annual Dues)</option>
                  <option value="one_time">One-Time Fee (Access pass / One-off levy)</option>
                  <option value="installments">Installment Plan (e.g. 3x Tuition payments)</option>
                  <option value="metered_pack">Metered Credit Pack (Hours / Bookings)</option>
                  <option value="sliding_scale">Sliding Scale / Donation (Pay what you want)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={planAmount}
                    onChange={(e) => setPlanAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                  />
                </div>

                {planBillingType === 'recurring' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                      Frequency
                    </label>
                    <select
                      value={planIntervalUnit}
                      onChange={(e) =>
                        setPlanIntervalUnit(e.target.value as 'month' | 'quarter' | 'year')
                      }
                      className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                    >
                      <option value="month">Monthly</option>
                      <option value="quarter">Quarterly</option>
                      <option value="year">Annually</option>
                    </select>
                  </div>
                )}

                {planBillingType === 'installments' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                      Number of Installments
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="12"
                      value={planInstallmentCount}
                      onChange={(e) => setPlanInstallmentCount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                    />
                  </div>
                )}

                {planBillingType === 'sliding_scale' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                      Minimum Amount ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={planMinAmount}
                      onChange={(e) => setPlanMinAmount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="What is covered by this payment?"
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                />
              </div>

              {/* Entitlements Selector */}
              <div className="border-t border-stone-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Granted Entitlements
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPlanEntitlements([
                        ...planEntitlements,
                        { targetType: 'space_access', targetId: spaces[0]?.id },
                      ])
                    }
                    className="text-xs font-semibold text-forest-700 hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Entitlement
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {planEntitlements.map((ent, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl bg-stone-50 border border-stone-200 p-2 text-xs"
                    >
                      <select
                        value={ent.targetType}
                        onChange={(e) => {
                          const updated = [...planEntitlements];
                          updated[idx].targetType = e.target.value as EntitlementTargetType;
                          setPlanEntitlements(updated);
                        }}
                        className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="circle_membership">Circle Membership</option>
                        <option value="space_access">Space Access</option>
                        <option value="course_access">Course Access</option>
                        <option value="resource_quota">Resource Quota / Credits</option>
                        <option value="badge_grant">Verified Badge</option>
                      </select>

                      {ent.targetType === 'space_access' && (
                        <select
                          value={ent.targetId || ''}
                          onChange={(e) => {
                            const updated = [...planEntitlements];
                            updated[idx].targetId = e.target.value;
                            setPlanEntitlements(updated);
                          }}
                          className="flex-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                        >
                          {spaces.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              #{sp.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {ent.targetType === 'resource_quota' && (
                        <input
                          type="number"
                          placeholder="Quota (e.g. 10 hours)"
                          value={planQuotaQuantity}
                          onChange={(e) => setPlanQuotaQuantity(e.target.value)}
                          className="w-24 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setPlanEntitlements(planEntitlements.filter((_, i) => i !== idx))
                        }
                        className="text-red-600 hover:text-red-800 ml-auto"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreatePlanModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Save Pricing Plan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ISSUE INVOICE */}
      {showCreateInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Issue Dues Invoice</h3>
            <p className="mt-1 text-sm text-stone-500">
              Create an assessment or bill for a specific community member.
            </p>

            <form onSubmit={handleCreateInvoice} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Target Member
                </label>
                <select
                  required
                  value={invUserId}
                  onChange={(e) => setInvUserId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                >
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile?.display_name || m.user_id} (@{m.profile?.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Select Plan (Optional)
                </label>
                <select
                  value={invPlanId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setInvPlanId(pid);
                    const selected = plans.find((p) => p.id === pid);
                    if (selected) {
                      setInvTitle(selected.name);
                      setInvAmount((selected.amount_cents / 100).toFixed(2));
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                >
                  <option value="">Custom one-off invoice</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${(p.amount_cents / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Invoice Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. October Maintenance Dues"
                  value={invTitle}
                  onChange={(e) => setInvTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Total Amount ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Notes / Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please settle before the 15th to maintain gate access"
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateInvoiceModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Issuing...' : 'Issue Invoice'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECONCILE OFFLINE PAYMENT */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Record Payment</h3>
            <p className="mt-1 text-sm text-stone-500">
              Reconcile offline bank transfer, cash, or credit. Fulfills member entitlements
              instantly.
            </p>

            <div className="mt-4 rounded-xl bg-stone-50 p-3 border border-stone-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Invoice:</span>
                <span className="font-semibold text-stone-800">
                  {showReconcileModal.invoice_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Title:</span>
                <span className="font-semibold text-stone-800">{showReconcileModal.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Amount Due:</span>
                <span className="font-bold text-forest-800">
                  ${(showReconcileModal.total_cents / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleReconcilePayment} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Payment Method
                </label>
                <select
                  value={recMethod}
                  onChange={(e) => setRecMethod(e.target.value as PaymentMethod)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                >
                  <option value="bank_transfer">Bank Transfer / Wire</option>
                  <option value="cash">Cash / Cheque</option>
                  <option value="manual_credit">Manual Credit</option>
                  <option value="external_erp">External Accounting ERP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Payment Reference / Transaction ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WIRE-CHASE-99210 or Bank Slip #"
                  value={recRef}
                  onChange={(e) => setRecRef(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Reconciliation Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified against bank statement line 14"
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recRecordTreasury}
                    onChange={(e) => setRecRecordTreasury(e.target.checked)}
                    className="rounded border-stone-300 text-forest-700 focus:ring-forest-600"
                  />
                  Record as Revenue in Community Treasury Ledger
                </label>

                {recRecordTreasury && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-600">
                      Treasury Category
                    </label>
                    <select
                      value={recCategory}
                      onChange={(e) => setRecCategory(e.target.value as TreasuryCategory)}
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="dues">Dues</option>
                      <option value="amenities">Amenities</option>
                      <option value="courses">Courses</option>
                      <option value="events">Events</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReconcileModal(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Settling...' : 'Confirm Payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD TREASURY ENTRY */}
      {showTreasuryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Record Treasury Entry</h3>
            <p className="mt-1 text-sm text-stone-500">
              Add income or expenses to your community financial balance sheet.
            </p>

            <form onSubmit={handleRecordTreasuryEntry} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Type
                  </label>
                  <select
                    value={trType}
                    onChange={(e) => setTrType(e.target.value as 'revenue' | 'expense')}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                  >
                    <option value="expense">Expense (-)</option>
                    <option value="revenue">Revenue (+)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Category
                  </label>
                  <select
                    value={trCategory}
                    onChange={(e) => setTrCategory(e.target.value as TreasuryCategory)}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                  >
                    <option value="maintenance">Maintenance</option>
                    <option value="utilities">Utilities</option>
                    <option value="amenities">Amenities</option>
                    <option value="reserve_fund">Reserve Fund</option>
                    <option value="dues">Dues</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Amount ($ USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={trAmount}
                  onChange={(e) => setTrAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gate motor repairs & sensor replacement"
                  value={trDescription}
                  onChange={(e) => setTrDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trIsPublic}
                    onChange={(e) => setTrIsPublic(e.target.checked)}
                    className="rounded border-stone-300 text-forest-700 focus:ring-forest-600"
                  />
                  Visible to Active Circle Members
                </label>
                <p className="mt-1 text-xs text-stone-500 pl-5">
                  When checked, active community members can see this transaction in the community
                  treasury ledger.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTreasuryModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Recording...' : 'Record Entry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
