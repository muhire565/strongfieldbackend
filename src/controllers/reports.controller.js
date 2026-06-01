import { supabaseAdmin } from '../services/supabase.admin.js';
import { z } from 'zod';

// In-memory cache: { key: { data, timestamp } }
const cache = new Map();
const CACHE_TTL = 60_000; // 60 seconds

function getCacheKey(fn, branchId, ...args) {
  return `${fn}:${branchId}:${args.join(':')}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// --- Zod schemas ---
const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const asAtSchema = z.object({
  as_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const groupBySchema = z.object({
  group_by: z.enum(['day', 'week', 'month', 'product', 'staff', 'payment_mode', 'client']).optional(),
});

const generalLedgerSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.string().optional(),
});

const comparativeSchema = z.object({
  p1_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  p1_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  p2_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  p2_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function defaultMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: firstDay.toISOString().split('T')[0],
    to: lastDay.toISOString().split('T')[0],
  };
}

function defaultAsAt() {
  return new Date().toISOString().split('T')[0];
}

// --- Helpers ---
function rpcEnvelope(data, period, branchId) {
  return {
    success: true,
    data,
    generated_at: new Date().toISOString(),
    period,
    branch: branchId,
  };
}

// 1. Income Statement
export const getIncomeStatement = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('income', branchId, from, to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_income_statement', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 2. Balance Sheet
export const getBalanceSheet = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = asAtSchema.parse(req.query);
    const asAt = parsed.as_at || defaultAsAt();

    const key = getCacheKey('bs', branchId, asAt);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_balance_sheet', {
        p_branch_id: branchId, p_as_at_date: asAt,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { as_at: asAt }, branchId));
  } catch (err) { next(err); }
};

// 3. Cash Flow
export const getCashFlow = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('cf', branchId, from, to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_cash_flow_statement', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 4. Sales Report
export const getSalesReport = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.merge(groupBySchema).parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();
    const groupBy = parsed.group_by || 'day';

    const key = getCacheKey('sales', branchId, from, to, groupBy);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_sales_report', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to, p_group_by: groupBy,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 5. Inventory Report
export const getInventoryReport = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('inv', branchId, from, to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_inventory_report', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 6. Credit Report
export const getCreditReport = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('credit', branchId, from, to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_credit_report', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 7. Payment Mode Report
export const getPaymentModeReport = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('pm', branchId, from, to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_payment_mode_report', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 8. Expenses Report
export const getExpensesReport = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('exp', branchId, from, to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_expenses_report', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 9. Owner Equity
export const getOwnerEquity = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('eq', branchId, from, to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_owner_equity_report', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 10. Trial Balance
export const getTrialBalance = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = asAtSchema.parse(req.query);
    const asAt = parsed.as_at || defaultAsAt();

    const key = getCacheKey('tb', branchId, asAt);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_trial_balance', {
        p_branch_id: branchId, p_as_at_date: asAt,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { as_at: asAt }, branchId));
  } catch (err) { next(err); }
};

// 11. General Ledger
export const getGeneralLedger = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = generalLedgerSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('gl', branchId, from, to, parsed.type || 'all');
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_general_ledger', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to, p_payment_mode: parsed.type || null,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};

// 12. Comparative
export const getComparative = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = comparativeSchema.parse(req.query);

    const key = getCacheKey('comp', branchId, parsed.p1_from, parsed.p1_to, parsed.p2_from, parsed.p2_to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_comparative_report', {
        p_branch_id: branchId,
        p_p1_from: parsed.p1_from, p_p1_to: parsed.p1_to,
        p_p2_from: parsed.p2_from, p_p2_to: parsed.p2_to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { p1: { from: parsed.p1_from, to: parsed.p1_to }, p2: { from: parsed.p2_from, to: parsed.p2_to } }, branchId));
  } catch (err) { next(err); }
};

// 13. Summary
export const getReportSummary = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const parsed = dateRangeSchema.parse(req.query);
    const { from, to } = parsed.from && parsed.to ? parsed : defaultMonthRange();

    const key = getCacheKey('sum', branchId, from, to);
    let data = getCached(key);
    if (!data) {
      const { data: rpcData, error } = await supabaseAdmin.rpc('rpc_report_summary', {
        p_branch_id: branchId, p_from_date: from, p_to_date: to,
      });
      if (error) throw error;
      data = rpcData;
      setCache(key, data);
    }
    res.json(rpcEnvelope(data, { from, to }, branchId));
  } catch (err) { next(err); }
};
