import { supabaseAdmin } from '../services/supabase.admin.js';
import { insertNotification } from './notifications.controller.js';

// Clients
export const listClients = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const search = cleanQueryParam(req.query.search);
    const type = cleanQueryParam(req.query.type);

    let query = supabaseAdmin.from('clients').select('*').eq('branch_id', branchId).order('full_name');

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (type) {
      query = query.eq('client_type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createClient = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({ ...req.body, branch_id: branchId })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getClientDetails = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
      
    if (clientErr) throw clientErr;
    
    const { data: sales, error: salesErr } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false });
      
    if (salesErr) throw salesErr;

    const { data: payments, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('*, sales!inner(client_id)')
      .eq('sales.client_id', id)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (payErr) throw payErr;

    res.json({ success: true, data: { ...client, sales, payments } });
  } catch (err) {
    next(err);
  }
};

export const updateClient = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('clients')
      .update(req.body)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Sales
export const createSale = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    
    const { 
      client_id, sale_type, subtotal, discount_amount, discount_type, 
      discount_value, tax_rate, tax_amount, total_amount, notes, 
      items, payment_mode, amount_paid, reference_number 
    } = req.body;
    
    const { data, error } = await supabaseAdmin.rpc('confirm_sale', {
      p_branch_id: branchId,
      p_client_id: client_id || null,
      p_sale_type: sale_type,
      p_subtotal: subtotal,
      p_discount_amount: discount_amount,
      p_discount_type: discount_type || 'none',
      p_discount_value: discount_value || 0,
      p_tax_rate: tax_rate || 0,
      p_tax_amount: tax_amount || 0,
      p_total_amount: total_amount,
      p_notes: notes || null,
      p_served_by: userId,
      p_items: items,
      p_payment_mode: payment_mode || null,
      p_amount_paid: amount_paid || 0,
      p_reference_number: reference_number || null
    });
    
    if (error) throw error;

    // Notification: sale completed
    if (data?.sale_number) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'sale_completed',
        title: `Sale ${data.sale_number} confirmed`,
        description: `Total: UGX ${req.body.total_amount?.toLocaleString() || 0}`,
        iconType: 'receipt',
        referenceId: String(data.sale_id || ''),
        referenceType: 'sale',
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

function cleanQueryParam(value) {
  return (value && value !== 'undefined' && String(value).trim()) ? String(value).trim() : undefined;
}

export const listSales = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const status = cleanQueryParam(req.query.status);
    const client_id = cleanQueryParam(req.query.client_id);
    const start_date = cleanQueryParam(req.query.start_date);
    const end_date = cleanQueryParam(req.query.end_date);
    const search = cleanQueryParam(req.query.search);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('sales')
      .select(`
        *,
        client:clients(full_name),
        served_by_user:profiles!sales_served_by_fkey(full_name),
        items:sale_items(count)
      `, { count: 'exact' })
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    if (client_id) query = query.eq('client_id', client_id);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);
    if (search) {
      query = query.or(`sale_number.ilike.%${search}%,client.full_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ success: true, data, count, page, limit });
  } catch (err) {
    next(err);
  }
};

export const getSaleDetails = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    
    const { data: sale, error } = await supabaseAdmin
      .from('sales')
      .select(`
        *,
        client:clients(*),
        items:sale_items(*),
        payments:payments(*),
        served_by_user:profiles!sales_served_by_fkey(full_name)
      `)
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
      
    if (error) throw error;
    res.json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
};

export const voidSale = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const { data, error } = await supabaseAdmin.rpc('void_sale', {
      p_sale_id: id,
      p_voided_by: userId,
      p_reason: reason || null
    });

    if (error) throw error;
    if (data && data.error) {
      const err = new Error(data.error);
      err.status = 400;
      throw err;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Payments
export const recordPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params; 
    const { amount, payment_mode, reference_number } = req.body;
    
    const { data, error } = await supabaseAdmin.rpc('record_payment', {
      p_sale_id: id,
      p_amount: amount,
      p_payment_mode: payment_mode,
      p_reference: reference_number || null,
      p_received_by: userId
    });
    
    if (error) throw error;

    // Notification: payment received or balance cleared
    if (data?.sale_number) {
      const isCleared = data.new_balance <= 0;
      await insertNotification({
        branchId: req.profile.branch_id,
        userId: null,
        type: isCleared ? 'credit_balance_cleared' : 'payment_received',
        title: isCleared ? 'Credit balance cleared' : 'Payment received',
        description: `Sale ${data.sale_number} — UGX ${req.body.amount?.toLocaleString() || 0} ${isCleared ? '(fully paid)' : `(balance: UGX ${data.new_balance?.toLocaleString() || 0})`}`,
        iconType: isCleared ? 'circle-check' : 'cash',
        referenceId: String(id),
        referenceType: 'sale',
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getSalePayments = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*, received_by_user:profiles!payments_received_by_fkey(full_name)')
      .eq('sale_id', id)
      .eq('branch_id', branchId)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getPaymentsByMode = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const start_date = cleanQueryParam(req.query.start_date);
    const end_date = cleanQueryParam(req.query.end_date);
    const payment_mode = cleanQueryParam(req.query.payment_mode);

    let query = supabaseAdmin
      .from('payments')
      .select(`*, sales(sale_number, status), received_by_user:profiles!payments_received_by_fkey(full_name)`)
      .eq('branch_id', branchId)
      .order('payment_date', { ascending: false });

    if (start_date) query = query.gte('payment_date', start_date);
    if (end_date) query = query.lte('payment_date', end_date);
    if (payment_mode) query = query.eq('payment_mode', payment_mode);

    const { data, error } = await query;
    if (error) throw error;

    // Exclude payments from voided sales
    const validPayments = (data || []).filter(p => p.sales?.status !== 'voided');
    res.json({ success: true, data: validPayments });
  } catch (err) {
    next(err);
  }
};

export const getSummary = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    // Today's sales
    const { data: todaySales, error: salesErr } = await supabaseAdmin
      .from('sales')
      .select('total_amount, amount_paid, status')
      .eq('branch_id', branchId)
      .gte('created_at', todayIso)
      .neq('status', 'voided');
    if (salesErr) throw salesErr;

    // Today's payments grouped by mode (exclude voided sales)
    const { data: todayPayments, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('payment_mode, amount, sales(status)')
      .eq('branch_id', branchId)
      .gte('payment_date', todayIso);
    if (payErr) throw payErr;

    const validPayments = (todayPayments || []).filter(p => p.sales?.status !== 'voided');

    const totalRevenue = todaySales.reduce((a, s) => a + (s.total_amount || 0), 0);
    const totalPaid = todaySales.reduce((a, s) => a + (s.amount_paid || 0), 0);
    const saleCount = todaySales.length;

    const modeTotals = {};
    validPayments.forEach(p => {
      modeTotals[p.payment_mode] = (modeTotals[p.payment_mode] || 0) + (p.amount || 0);
    });

    res.json({
      success: true,
      data: {
        sale_count: saleCount,
        total_revenue: totalRevenue,
        total_paid: totalPaid,
        cash: modeTotals.cash || 0,
        mtn_mobile_money: modeTotals.mtn_mobile_money || 0,
        airtel_money: modeTotals.airtel_money || 0,
        bank_transfer: modeTotals.bank_transfer || 0,
      }
    });
  } catch (err) {
    next(err);
  }
};

// Quotations
export const listQuotations = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const status = cleanQueryParam(req.query.status);
    const search = cleanQueryParam(req.query.search);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('quotations')
      .select('*, client:clients(full_name), items:quotation_items(count)', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(`quotation_number.ilike.%${search}%,client.full_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ success: true, data, count, page, limit });
  } catch (err) {
    next(err);
  }
};

export const createQuotation = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const userId = req.user.id;
    const {
      client_id, client_name_snapshot, subtotal, discount_amount,
      discount_type, discount_value, tax_rate, tax_amount, total_amount,
      valid_until, notes, items
    } = req.body;

    const { data, error } = await supabaseAdmin.rpc('create_quotation', {
      p_branch_id: branchId,
      p_client_id: client_id || null,
      p_client_name_snapshot: client_name_snapshot || null,
      p_subtotal: subtotal,
      p_discount_amount: discount_amount || 0,
      p_discount_type: discount_type || 'none',
      p_discount_value: discount_value || 0,
      p_tax_rate: tax_rate || 0,
      p_tax_amount: tax_amount || 0,
      p_total_amount: total_amount,
      p_valid_until: valid_until || null,
      p_notes: notes || null,
      p_created_by: userId,
      p_items: items
    });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getQuotationDetails = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('quotations')
      .select('*, client:clients(*), items:quotation_items(*), created_by_user:profiles!quotations_created_by_fkey(full_name)')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateQuotation = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;
    const {
      client_id, client_name_snapshot, subtotal, discount_amount,
      discount_type, discount_value, tax_rate, tax_amount, total_amount,
      valid_until, notes, items
    } = req.body;

    // Update the quotation header
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('quotations')
      .update({
        client_id: client_id || null,
        client_name_snapshot: client_name_snapshot || null,
        subtotal,
        discount_amount: discount_amount || 0,
        discount_type: discount_type || 'none',
        discount_value: discount_value || 0,
        tax_rate: tax_rate || 0,
        tax_amount: tax_amount || 0,
        total_amount,
        valid_until: valid_until || null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .eq('status', 'draft')
      .select()
      .single();

    if (updErr) throw updErr;
    if (!updated) {
      const err = new Error('Quotation not found or not in draft status');
      err.status = 404;
      throw err;
    }

    // Delete old items and insert new ones
    await supabaseAdmin.from('quotation_items').delete().eq('quotation_id', id);

    const itemRows = items.map(item => ({
      quotation_id: id,
      branch_id: branchId,
      product_id: item.product_id || null,
      product_name: item.product_name,
      brand: item.brand || '',
      model: item.model || '',
      unit_price: item.unit_price,
      purchase_price: item.purchase_price || 0,
      quantity: item.quantity,
      discount_amount: item.discount_amount || 0,
      line_total: item.line_total
    }));

    const { error: itemsErr } = await supabaseAdmin.from('quotation_items').insert(itemRows);
    if (itemsErr) throw itemsErr;

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const convertQuotation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { sale_type, amount_paid, payment_mode, reference_number } = req.body;

    const { data, error } = await supabaseAdmin.rpc('convert_quotation_to_sale', {
      p_quote_id: id,
      p_served_by: userId,
      p_sale_type: sale_type || 'cash_sale',
      p_amount_paid: amount_paid || 0,
      p_payment_mode: payment_mode || null,
      p_reference_number: reference_number || null
    });

    if (error) throw error;
    if (data && data.error) {
      const err = new Error(data.error);
      err.status = 400;
      throw err;
    }

    // Notification: quotation converted
    if (data?.sale_number) {
      await insertNotification({
        branchId: req.profile.branch_id,
        userId: null,
        type: 'quotation_converted',
        title: `Quotation converted to ${data.sale_number}`,
        description: 'Quotation was successfully converted to a sale',
        iconType: 'file-text',
        referenceId: String(data.sale_id || ''),
        referenceType: 'sale',
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const cancelQuotation = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('quotations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('branch_id', branchId)
      .eq('status', 'draft')
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      const err = new Error('Quotation not found or not in draft status');
      err.status = 404;
      throw err;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
