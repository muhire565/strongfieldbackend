import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as posController from '../controllers/pos.controller.js';

const router = Router();

// All POS routes require authentication
router.use(authenticate);

// Clients
router.get('/clients', posController.listClients);
router.post('/clients', posController.createClient);
router.get('/clients/:id', posController.getClientDetails);
router.patch('/clients/:id', authorize('admin'), posController.updateClient);

// Sales
router.get('/sales', posController.listSales);
router.post('/sales', authorize('admin'), posController.createSale);
router.get('/sales/:id', posController.getSaleDetails);
router.patch('/sales/:id/void', authorize('admin'), posController.voidSale);

// Payments (installments)
router.post('/sales/:id/payments', authorize('admin'), posController.recordPayment);
router.get('/sales/:id/payments', posController.getSalePayments);

// Quotations
router.get('/quotations', posController.listQuotations);
router.post('/quotations', authorize('admin'), posController.createQuotation);
router.get('/quotations/:id', posController.getQuotationDetails);
router.patch('/quotations/:id', authorize('admin'), posController.updateQuotation);
router.patch('/quotations/:id/convert', authorize('admin'), posController.convertQuotation);
router.patch('/quotations/:id/cancel', authorize('admin'), posController.cancelQuotation);

// Reports
router.get('/summary', authorize('admin'), posController.getSummary);
router.get('/payments/by-mode', authorize('admin'), posController.getPaymentsByMode);

export default router;
