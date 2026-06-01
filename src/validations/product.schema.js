import { z } from 'zod';

export const createProductBodySchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  price: z.number().positive(),
  purchase_price: z.number().positive(),
  quantity: z.number().int().min(0),
  low_stock_threshold: z.number().int().min(1).default(5),
});

export const updateProductBodySchema = createProductBodySchema.partial();

export const exportProductSchema = z.object({
  target_branch_id: z.string().uuid(),
  quantity: z.number().int().min(1, 'Must export at least 1 unit'),
  notes: z.string().max(500).optional(),
});
