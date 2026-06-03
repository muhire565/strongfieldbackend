import { supabaseAdmin } from '../services/supabase.admin.js';
import { insertNotification } from './notifications.controller.js';

function cleanQueryParam(value) {
  return (value && value !== 'undefined' && String(value).trim()) ? String(value).trim() : undefined;
}

// Balances
export const getBalances = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { data, error } = await supabaseAdmin
      .from('payment_mode_balances')
      .select('*')
      .eq('branch_id', branchId)
      .order('payment_mode', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Capital
export const listCapital = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const from_date = cleanQueryParam(req.query.from_date);
    const to_date = cleanQueryParam(req.query.to_date);
    const payment_mode = cleanQueryParam(req.query.payment_mode);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('capital_accounts')
      .select('*, injected_by_user:profiles!capital_accounts_injected_by_fkey(full_name)', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('injection_date', { ascending: false });

    if (from_date) query = query.gte('injection_date', from_date);
    if (to_date) query = query.lte('injection_date', to_date + 'T23:59:59');
    if (payment_mode) query = query.eq('payment_mode', payment_mode);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    res.json({ success: true, data, count, page, limit });
  } catch (err) {
    next(err);
  }
};

export const injectCapital = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    const { amount, payment_mode, description, source } = req.body;

    const { data, error } = await supabaseAdmin.rpc('inject_capital', {
      p_branch_id: branchId,
      p_amount: amount,
      p_payment_mode: payment_mode,
      p_description: description,
      p_source: source || null,
      p_performed_by: userId,
    });

    if (error) throw error;

    // Notification: capital injected if amount > 1,000,000
    if (amount > 1000000) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'capital_injected',
        title: `Capital injected: UGX ${Number(amount).toLocaleString()}`,
        description: `Source: ${req.body.source || 'General'} · ${req.body.payment_mode || 'cash'}`,
        iconType: 'coins',
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Expenses
export const listExpenses = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const from_date = cleanQueryParam(req.query.from_date);
    const to_date = cleanQueryParam(req.query.to_date);
    const category = cleanQueryParam(req.query.category);
    const payment_mode = cleanQueryParam(req.query.payment_mode);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('expenses')
      .select('*, recorded_by_user:profiles!expenses_recorded_by_fkey(full_name)', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('expense_date', { ascending: false });

    if (from_date) query = query.gte('expense_date', from_date);
    if (to_date) query = query.lte('expense_date', to_date);
    if (category) query = query.eq('category', category);
    if (payment_mode) query = query.eq('payment_mode', payment_mode);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    res.json({ success: true, data, count, page, limit });
  } catch (err) {
    next(err);
  }
};

export const recordExpense = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    const { category, description, amount, payment_mode, vendor, reference_number, expense_date } = req.body;

    const { data, error } = await supabaseAdmin.rpc('record_expense', {
      p_branch_id: branchId,
      p_category: category,
      p_description: description,
      p_amount: amount,
      p_payment_mode: payment_mode,
      p_vendor: vendor || null,
      p_reference_number: reference_number || null,
      p_expense_date: expense_date || new Date().toISOString().split('T')[0],
      p_performed_by: userId,
    });

    if (error) throw error;
    if (!data?.success) {
      const err = new Error(data?.error || 'Transaction failed');
      err.status = 400;
      err.response = { data };
      throw err;
    }
    // Notification: expense recorded
    if (data?.expense_number) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'expense_recorded',
        title: `Expense: ${req.body.category} UGX ${Number(req.body.amount).toLocaleString()}`,
        description: req.body.description || 'Expense recorded',
        iconType: 'receipt-2',
        referenceId: data.expense_number,
        referenceType: 'expense',
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getExpenseDetail = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select('*, recorded_by_user:profiles!expenses_recorded_by_fkey(full_name)')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Withdrawals
export const listWithdrawals = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const from_date = cleanQueryParam(req.query.from_date);
    const to_date = cleanQueryParam(req.query.to_date);
    const purpose = cleanQueryParam(req.query.purpose);
    const payment_mode = cleanQueryParam(req.query.payment_mode);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('owner_withdrawals')
      .select('*, recorded_by_user:profiles!owner_withdrawals_recorded_by_fkey(full_name)', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('withdrawal_date', { ascending: false });

    if (from_date) query = query.gte('withdrawal_date', from_date);
    if (to_date) query = query.lte('withdrawal_date', to_date + 'T23:59:59');
    if (purpose) query = query.eq('purpose', purpose);
    if (payment_mode) query = query.eq('payment_mode', payment_mode);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    res.json({ success: true, data, count, page, limit });
  } catch (err) {
    next(err);
  }
};

export const recordWithdrawal = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    const { amount, payment_mode, purpose, description, reference_number } = req.body;

    const { data, error } = await supabaseAdmin.rpc('record_withdrawal', {
      p_branch_id: branchId,
      p_amount: amount,
      p_payment_mode: payment_mode,
      p_purpose: purpose,
      p_description: description,
      p_reference_number: reference_number || null,
      p_performed_by: userId,
    });

    if (error) throw error;
    if (!data?.success) {
      const err = new Error(data?.error || 'Transaction failed');
      err.status = 400;
      err.response = { data };
      throw err;
    }
    // Notification: large withdrawal
    if (data?.withdrawal_number && req.body.amount > 500000) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'large_withdrawal',
        title: `Withdrawal: UGX ${Number(req.body.amount).toLocaleString()}`,
        description: `Purpose: ${req.body.purpose || 'General'} · ${req.body.payment_mode || 'cash'}`,
        iconType: 'cash-off',
        referenceId: data.withdrawal_number,
        referenceType: 'withdrawal',
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getWithdrawalDetail = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('owner_withdrawals')
      .select('*, recorded_by_user:profiles!owner_withdrawals_recorded_by_fkey(full_name)')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Goods Purchases
export const listPurchases = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const from_date = cleanQueryParam(req.query.from_date);
    const to_date = cleanQueryParam(req.query.to_date);
    const status = cleanQueryParam(req.query.status);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('goods_purchases')
      .select('*, recorded_by_user:profiles!goods_purchases_recorded_by_fkey(full_name), purchase_items(count)', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('purchase_date', { ascending: false });

    if (from_date) query = query.gte('purchase_date', from_date);
    if (to_date) query = query.lte('purchase_date', to_date);
    if (status) query = query.eq('payment_status', status);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    res.json({ success: true, data, count, page, limit });
  } catch (err) {
    next(err);
  }
};

export const recordPurchase = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    const { supplier_id, supplier_name, supplier_contact, items, amount_paid, payment_mode, reference_number, purchase_date } = req.body;

    const { data, error } = await supabaseAdmin.rpc('record_goods_purchase', {
      p_branch_id: branchId,
      p_supplier_id: supplier_id || null,
      p_supplier_name: supplier_name || null,
      p_supplier_contact: supplier_contact || null,
      p_items: items || [],
      p_amount_paid: amount_paid || 0,
      p_payment_mode: payment_mode || null,
      p_reference_number: reference_number || null,
      p_purchase_date: purchase_date || new Date().toISOString().split('T')[0],
      p_performed_by: userId,
    });

    if (error) throw error;
    if (!data?.success) {
      const err = new Error(data?.error || 'Transaction failed');
      err.status = 400;
      err.response = { data };
      throw err;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getPurchaseDetail = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('goods_purchases')
      .select('*, recorded_by_user:profiles!goods_purchases_recorded_by_fkey(full_name), purchase_items(*)')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Transactions Ledger
export const listTransactions = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const from_date = cleanQueryParam(req.query.from_date);
    const to_date = cleanQueryParam(req.query.to_date);
    const transaction_type = cleanQueryParam(req.query.transaction_type);
    const payment_mode = cleanQueryParam(req.query.payment_mode);
    const direction = cleanQueryParam(req.query.direction);
    const performed_by = cleanQueryParam(req.query.performed_by);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('finance_transactions')
      .select('*, performer:profiles!finance_transactions_performed_by_fkey(full_name)', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('transaction_date', { ascending: false });

    if (from_date) query = query.gte('transaction_date', from_date);
    if (to_date) query = query.lte('transaction_date', to_date + 'T23:59:59');
    if (transaction_type) query = query.eq('transaction_type', transaction_type);
    if (payment_mode) query = query.eq('payment_mode', payment_mode);
    if (direction) query = query.eq('direction', direction);
    if (performed_by) query = query.eq('performed_by', performed_by);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    res.json({ success: true, data, count, page, limit });
  } catch (err) {
    next(err);
  }
};

export const getTransactionDetail = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('finance_transactions')
      .select('*, performer:profiles!finance_transactions_performed_by_fkey(full_name)')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Summary
export const getSummary = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const from_date = cleanQueryParam(req.query.from_date);
    const to_date = cleanQueryParam(req.query.to_date);

    const { data, error } = await supabaseAdmin.rpc('get_financial_summary', {
      p_branch_id: branchId,
      p_from_date: from_date || null,
      p_to_date: to_date || null,
    });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Cashflow
export const getCashflow = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const from_date = cleanQueryParam(req.query.from_date);
    const to_date = cleanQueryParam(req.query.to_date);
    const start = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const end = to_date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('finance_transactions')
      .select('transaction_date, direction, amount, transaction_type')
      .eq('branch_id', branchId)
      .gte('transaction_date', start)
      .lte('transaction_date', end + 'T23:59:59')
      .order('transaction_date', { ascending: true });

    if (error) throw error;

    const daily = {};
    (data || []).forEach(t => {
      const day = t.transaction_date.split('T')[0];
      if (!daily[day]) daily[day] = { date: day, inflow: 0, outflow: 0 };
      if (t.direction === 'credit') daily[day].inflow += Number(t.amount || 0);
      else daily[day].outflow += Number(t.amount || 0);
    });

    res.json({ success: true, data: Object.values(daily) });
  } catch (err) {
    next(err);
  }
};

// Suppliers
export const listSuppliers = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const search = cleanQueryParam(req.query.search);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('suppliers')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (search) query = query.ilike('name', `%${search}%`);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    res.json({ success: true, data, count, page, limit });
  } catch (err) {
    next(err);
  }
};

export const createSupplier = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { name, contact, email, address, notes } = req.body;
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .insert({ branch_id: branchId, name, contact, email, address, notes })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getSupplierDetail = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const { data: supplier, error: serr } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    if (serr) throw serr;

    const { data: purchases, error: perr } = await supabaseAdmin
      .from('goods_purchases')
      .select('*, purchase_items(*)')
      .eq('supplier_id', id)
      .eq('branch_id', branchId)
      .order('purchase_date', { ascending: false });
    if (perr) throw perr;

    // Fetch supplier payment transactions
    const { data: payments, error: txnErr } = await supabaseAdmin
      .from('finance_transactions')
      .select('id, transaction_date, amount, payment_mode, description, reference_id, created_at')
      .eq('branch_id', branchId)
      .eq('reference_type', 'supplier_payment')
      .ilike('description', `%${supplier.name}%`)
      .order('transaction_date', { ascending: false });
    if (txnErr) throw txnErr;

    // Build unified statement (oldest first for running balance)
    const events = [];
    for (const p of purchases || []) {
      events.push({
        date: p.purchase_date,
        type: 'purchase',
        reference: p.purchase_number,
        description: p.description || 'Purchase',
        amount: parseFloat(p.total_amount) || 0,
        paid: parseFloat(p.amount_paid) || 0,
        balance_due: parseFloat(p.balance_due) || 0,
        status: p.payment_status,
        items: p.purchase_items || [],
      });
    }
    for (const t of payments || []) {
      events.push({
        date: t.transaction_date ? t.transaction_date.split('T')[0] : t.created_at.split('T')[0],
        type: 'payment',
        reference: t.reference_id || `TXN-${t.id}`,
        description: t.description || 'Supplier payment',
        amount: parseFloat(t.amount) || 0,
        payment_mode: t.payment_mode,
      });
    }
    events.sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date);
      return d !== 0 ? d : (a.type === 'purchase' ? -1 : 1);
    });

    let runningBalance = 0;
    const statement = events.map(e => {
      if (e.type === 'purchase') {
        runningBalance += e.amount;
        return { ...e, running_balance: runningBalance };
      } else {
        runningBalance -= e.amount;
        return { ...e, running_balance: runningBalance };
      }
    });

    res.json({ success: true, data: { supplier, purchases, payments, statement } });
  } catch (err) {
    next(err);
  }
};

export const supplierPayment = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    const { id } = req.params;
    const { amount, payment_mode, reference_number } = req.body;

    const { data, error } = await supabaseAdmin.rpc('supplier_make_payment', {
      p_branch_id: branchId,
      p_supplier_id: id,
      p_amount: amount,
      p_payment_mode: payment_mode,
      p_reference_number: reference_number || null,
      p_performed_by: userId,
    });

    if (error) throw error;
    if (!data?.success) {
      const err = new Error(data?.error || 'Payment failed');
      err.status = 400;
      err.response = { data };
      throw err;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
