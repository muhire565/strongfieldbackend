import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as inventoryController from '../controllers/inventory.controller.js';

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

// Read endpoints
router.get('/', inventoryController.listInventory);
router.get('/summary', inventoryController.getSummary);
router.get('/movements/all', inventoryController.getAllMovements);
router.get('/:id', inventoryController.getOne);
router.get('/:id/movements', inventoryController.getMovements);

// Write endpoints (Admin + Stock Manager)
router.post('/:id/stock-in', authorize(['admin', 'stock_manager']), inventoryController.stockIn);
router.post('/:id/stock-out', authorize(['admin', 'stock_manager']), inventoryController.stockOut);

export default router;
