import { supabaseAdmin } from '../services/supabase.admin.js';
import { insertNotification } from './notifications.controller.js';
import { stockInSchema, stockOutSchema } from '../validations/inventory.schema.js';

function cleanQueryParam(value) {
  return (value && value !== 'undefined' && String(value).trim()) ? String(value).trim() : undefined;
}

const getStockStatus = (quantity, threshold) => {
  if (quantity === 0) return 'Out of Stock';
  if (quantity <= threshold) return 'Low Stock';
  return 'In Stock';
};

const STATUS_MAP = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

// GET /api/inventory
export const listInventory = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const search = cleanQueryParam(req.query.search);
    const status = cleanQueryParam(req.query.status);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    // When filtering by status we must fetch the full dataset first,
    // because stock_status is computed in JS and Supabase doesn't know it.
    const needsFullFetch = status && STATUS_MAP[status];

    let allProducts = [];

    if (needsFullFetch) {
      const pageSize = 1000;
      let p = 0;
      while (true) {
        let query = supabaseAdmin
          .from('products')
          .select('*')
          .eq('branch_id', branchId)
          .order('id', { ascending: true })
          .range(p * pageSize, (p + 1) * pageSize - 1);

        if (search) {
          query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allProducts.push(...data);
        if (data.length < pageSize) break;
        p++;
      }
    } else {
      let query = supabaseAdmin
        .from('products')
        .select('*', { count: 'exact' })
        .eq('branch_id', branchId)
        .order('name', { ascending: true })
        .range((page - 1) * limit, page * limit - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      allProducts = data || [];
      // Fast path: no status filter, return DB paginated result directly
      const enriched = allProducts.map((p) => ({
        ...p,
        stock_value: parseFloat(((p.purchase_price || 0) * p.quantity).toFixed(2)),
        potential_sales_value: parseFloat(((p.price || 0) * p.quantity).toFixed(2)),
        stock_status: getStockStatus(p.quantity, p.low_stock_threshold),
      }));
      return res.json({ success: true, data: enriched, count });
    }

    // Enrich and filter by status
    let enriched = allProducts.map((p) => ({
      ...p,
      stock_value: parseFloat(((p.purchase_price || 0) * p.quantity).toFixed(2)),
      potential_sales_value: parseFloat(((p.price || 0) * p.quantity).toFixed(2)),
      stock_status: getStockStatus(p.quantity, p.low_stock_threshold),
    }));

    if (needsFullFetch) {
      enriched = enriched.filter((p) => p.stock_status === STATUS_MAP[status]);
    }

    // Manual pagination over the filtered set
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = enriched.slice(start, end);

    return res.json({
      success: true,
      data: paginated,
      count: paginated.length,
      total: enriched.length,
      page,
      limit,
    });
  } catch (err) { next(err); }
};

// GET /api/inventory/:id
export const getOne = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const enriched = {
      ...data,
      stock_value: parseFloat(((data.purchase_price || 0) * data.quantity).toFixed(2)),
      potential_sales_value: parseFloat(((data.price || 0) * data.quantity).toFixed(2)),
      stock_status: getStockStatus(data.quantity, data.low_stock_threshold),
    };

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
};

// GET /api/inventory/:id/movements
export const getMovements = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const productId = parseInt(req.params.id);
    const type = cleanQueryParam(req.query.type);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

    let query = supabaseAdmin
      .from('stock_movements')
      .select(`
        *,
        performer:profiles!performed_by(full_name, username, role),
        product:products!product_id(name, brand, model)
      `, { count: 'exact' })
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .order('performed_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (type) query = query.eq('movement_type', type);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({ success: true, data, count, page, limit });
  } catch (err) { next(err); }
};

// GET /api/inventory/movements/all
export const getAllMovements = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const type = cleanQueryParam(req.query.type);
    const search = cleanQueryParam(req.query.search);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    let query = supabaseAdmin
      .from('stock_movements')
      .select(`
        *,
        performer:profiles!performed_by(full_name, username, role),
        product:products!inner(name, brand, model)
      `, { count: 'exact' })
      .eq('branch_id', branchId)
      .order('performed_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (type) query = query.eq('movement_type', type);

    // We use inner join for product so we can filter by product name if needed
    if (search) {
      query = query.ilike('product.name', `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({ success: true, data, count, page, limit });
  } catch (err) { next(err); }
};

// GET /api/inventory/summary
export const getSummary = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const pageSize = 1000;

    // Paginate through all products to avoid Supabase's default 1000-row limit
    const allProducts = [];
    let page = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('quantity, price, purchase_price, low_stock_threshold')
        .eq('branch_id', branchId)
        .order('id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allProducts.push(...data);
      if (data.length < pageSize) break;
      page++;
    }

    let total = allProducts.length;
    let lowStock = 0;
    let outOfStock = 0;
    let stockValue = 0;
    let potentialSalesValue = 0;

    allProducts.forEach((p) => {
      const status = getStockStatus(p.quantity, p.low_stock_threshold);
      if (status === 'Out of Stock') outOfStock++;
      if (status === 'Low Stock') lowStock++;

      stockValue += (p.purchase_price * p.quantity);
      potentialSalesValue += ((p.price || 0) * p.quantity);
    });

    const potentialProfit = potentialSalesValue - stockValue;

    res.json({
      success: true,
      data: { total, lowStock, outOfStock, stockValue, potentialSalesValue, potentialProfit }
    });
  } catch (err) { next(err); }
};

// POST /api/inventory/:id/stock-in
export const stockIn = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const productId = parseInt(req.params.id);
    const performedBy = req.profile.id;

    const parsed = stockInSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { quantity, unit_cost, reference_id, notes } = parsed.data;

    const { data, error } = await supabaseAdmin.rpc('perform_stock_in', {
      p_product_id:   productId,
      p_branch_id:    branchId,
      p_quantity:     quantity,
      p_unit_cost:    unit_cost ?? null,
      p_reference_id: reference_id ?? null,
      p_notes:        notes ?? null,
      p_performed_by: performedBy,
    });

    if (error) throw error;
    if (!data.success) return res.status(400).json({ success: false, error: data.error });

    // Notifications for stock changes
    const qtyAfter = data.quantity_after;
    const { data: product } = await supabaseAdmin.from('products').select('low_stock_threshold').eq('id', productId).single();
    const threshold = product?.low_stock_threshold || 0;

    if (qtyAfter === 0) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'out_of_stock',
        title: `Out of stock: ${data.product_name}`,
        description: 'Stock reached zero after stock-in adjustment',
        iconType: 'alert-circle',
        referenceId: String(productId),
        referenceType: 'product',
      });
    } else if (qtyAfter <= threshold && qtyAfter > 0) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'low_stock',
        title: `Low stock: ${data.product_name}`,
        description: `Only ${qtyAfter} unit(s) remaining (threshold: ${threshold})`,
        iconType: 'alert-triangle',
        referenceId: String(productId),
        referenceType: 'product',
      });
    } else if (qtyAfter > 0) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'stock_in',
        title: `Stock received: ${data.product_name}`,
        description: `${quantity} unit(s) added. New total: ${qtyAfter}`,
        iconType: 'package',
        referenceId: String(productId),
        referenceType: 'product',
      });
    }

    return res.json({
      success: true,
      data,
      message: `${quantity} unit(s) added to ${data.product_name}. New stock: ${data.quantity_after}`,
    });
  } catch (err) { next(err); }
};

// POST /api/inventory/:id/stock-out
export const stockOut = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const productId = parseInt(req.params.id);
    const performedBy = req.profile.id;

    const parsed = stockOutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { quantity, reason, reference_id, notes } = parsed.data;

    const { data, error } = await supabaseAdmin.rpc('perform_stock_out', {
      p_product_id:   productId,
      p_branch_id:    branchId,
      p_quantity:     quantity,
      p_reason:       reason,
      p_reference_id: reference_id ?? null,
      p_notes:        notes ?? null,
      p_performed_by: performedBy,
    });

    if (error) throw error;
    if (!data.success) return res.status(400).json({ success: false, error: data.error });

    // Notifications for stock depletion
    const qtyAfter = data.quantity_after;
    const { data: product } = await supabaseAdmin.from('products').select('low_stock_threshold').eq('id', productId).single();
    const threshold = product?.low_stock_threshold || 0;

    if (qtyAfter === 0) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'out_of_stock',
        title: `Out of stock: ${data.product_name}`,
        description: 'Stock depleted after stock-out',
        iconType: 'alert-circle',
        referenceId: String(productId),
        referenceType: 'product',
      });
    } else if (qtyAfter <= threshold) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'low_stock',
        title: `Low stock: ${data.product_name}`,
        description: `Only ${qtyAfter} unit(s) remaining (threshold: ${threshold})`,
        iconType: 'alert-triangle',
        referenceId: String(productId),
        referenceType: 'product',
      });
    }

    return res.json({
      success: true,
      data,
      message: `${quantity} unit(s) removed from ${data.product_name}. Remaining: ${data.quantity_after}`,
    });
  } catch (err) { next(err); }
};
