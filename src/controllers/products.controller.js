import { supabaseAdmin } from '../services/supabase.admin.js';
import { insertNotification } from './notifications.controller.js';

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

export const list = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { search, status } = req.query;

    // Paginate through all products to avoid Supabase's 1000-row default limit
    const allProducts = [];
    const pageSize = 1000;
    let page = 0;
    while (true) {
      let query = supabaseAdmin
        .from('products')
        .select('*')
        .eq('branch_id', branchId)
        .order('id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search?.trim() && search !== 'undefined') {
        const term = search.trim();
        query = query.or(`name.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      allProducts.push(...data);
      if (data.length < pageSize) break;
      page++;
    }

    let products = allProducts;

    if (status && STATUS_MAP[status]) {
      const targetStatus = STATUS_MAP[status];
      products = products.filter(
        (p) => getStockStatus(p.quantity, p.low_stock_threshold) === targetStatus
      );
    }

    res.json({ success: true, data: products, count: products.length, debug: { branchId } });
  } catch (err) {
    next(err);
  }
};

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

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([{ ...req.body, branch_id: branchId }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(req.body)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Product not found in this branch' });
    }

    // Notification: low stock if quantity updated to threshold or below
    if (data.quantity <= data.low_stock_threshold && data.quantity > 0) {
      await insertNotification({
        branchId,
        userId: null,
        type: 'low_stock',
        title: `Low stock: ${data.name}`,
        description: `Only ${data.quantity} unit(s) remaining (threshold: ${data.low_stock_threshold})`,
        iconType: 'alert-triangle',
        referenceId: String(data.id),
        referenceType: 'product',
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;
    const { id } = req.params;

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (findErr || !existing) {
      return res.status(404).json({ success: false, error: 'Product not found in this branch' });
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

export const exportProduct = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const exportedBy = req.profile.id;
    const sourceBranchId = req.profile.branch_id;

    const { target_branch_id, quantity, notes } = req.body;

    const { data: targetBranch, error: branchErr } = await supabaseAdmin
      .from('branches')
      .select('id, name')
      .eq('id', target_branch_id)
      .single();

    if (branchErr || !targetBranch) {
      return res.status(400).json({ success: false, error: 'Target branch not found' });
    }

    if (target_branch_id === sourceBranchId) {
      return res.status(400).json({ success: false, error: 'Cannot export to the same branch' });
    }

    const { data, error } = await supabaseAdmin.rpc('export_product_to_branch', {
      p_product_id: productId,
      p_target_branch_id: target_branch_id,
      p_quantity: quantity,
      p_exported_by: exportedBy,
      p_notes: notes ?? null,
    });

    if (error) throw error;

    const result = data;
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Notifications: export and import
    await insertNotification({
      branchId: sourceBranchId,
      userId: null,
      type: 'product_exported',
      title: `Export to ${targetBranch.name}: ${result.product_name || 'Product'}`,
      description: `${quantity} unit(s) exported`,
      iconType: 'arrow-right-circle',
      referenceId: String(productId),
      referenceType: 'product',
    });

    await insertNotification({
      branchId: target_branch_id,
      userId: null,
      type: 'product_imported',
      title: `Import from source branch: ${result.product_name || 'Product'}`,
      description: `${quantity} unit(s) received`,
      iconType: 'package-check',
      referenceId: String(productId),
      referenceType: 'product',
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: `${quantity} unit(s) exported to ${targetBranch.name} branch successfully`,
    });
  } catch (err) {
    next(err);
  }
};

export const listExports = async (req, res, next) => {
  try {
    const branchId = req.profile.branch_id;

    const { data, error } = await supabaseAdmin
      .from('product_exports')
      .select(`
        id,
        product_id,
        source_branch_id,
        target_branch_id,
        quantity_exported,
        exported_by,
        exported_at,
        notes,
        source_branch:branches!source_branch_id (name),
        target_branch:branches!target_branch_id (name),
        exporter:profiles!exported_by (full_name),
        product:products!product_id (name)
      `)
      .or(`source_branch_id.eq.${branchId},target_branch_id.eq.${branchId}`)
      .order('exported_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
};
