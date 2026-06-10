import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as productsController from '../controllers/products.controller.js';
import {
  createProductBodySchema,
  updateProductBodySchema,
  exportProductSchema,
} from '../validations/product.schema.js';

const router = express.Router();

const createProductSchema = z.object({
  body: createProductBodySchema,
});

const updateProductSchema = z.object({
  body: updateProductBodySchema,
});

const exportSchema = z.object({
  body: exportProductSchema,
});

router.get('/', authenticate, productsController.list);
router.get('/exports/all', authenticate, authorize('admin'), productsController.listExports);
router.get('/:id', authenticate, productsController.getOne);
router.post(
  '/',
  authenticate,
  authorize(['admin', 'stock_manager']),
  validate(createProductSchema),
  productsController.create
);
router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'stock_manager']),
  validate(updateProductSchema),
  productsController.update
);
router.delete('/:id', authenticate, authorize('admin'), productsController.remove);

router.post(
  '/:id/export',
  authenticate,
  authorize('admin'),
  validate(exportSchema),
  productsController.exportProduct
);

export default router;
