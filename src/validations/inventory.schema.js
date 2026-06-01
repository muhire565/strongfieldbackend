import { z } from 'zod';

export const stockInSchema = z.object({
  quantity:      z.number().int().min(1, 'Quantity must be at least 1'),
  unit_cost:     z.number().positive().optional(),
  reference_id:  z.string().max(100).optional(),
  notes:         z.string().max(500).optional(),
});

export const stockOutSchema = z.object({
  quantity:      z.number().int().min(1, 'Quantity must be at least 1'),
  reason:        z.enum(['stock_out', 'sale', 'adjustment'], {
                   errorMap: () => ({ message: 'Reason must be stock_out, sale, or adjustment' }),
                 }),
  reference_id:  z.string().max(100).optional(),
  notes:         z.string().max(500).optional(),
});
