import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getIncomeStatement, getBalanceSheet, getCashFlow,
  getSalesReport, getInventoryReport, getCreditReport,
  getPaymentModeReport, getExpensesReport, getOwnerEquity,
  getTrialBalance, getGeneralLedger, getComparative, getReportSummary,
} from '../controllers/reports.controller.js';

const router = Router();

// Dedicated rate limit for reports (compute-heavy)
const reportsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { success: false, error: 'Too many report requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate, authorize('admin'), reportsLimiter);

router.get('/income-statement', getIncomeStatement);
router.get('/balance-sheet', getBalanceSheet);
router.get('/cash-flow', getCashFlow);
router.get('/sales', getSalesReport);
router.get('/inventory', getInventoryReport);
router.get('/credit', getCreditReport);
router.get('/payment-modes', getPaymentModeReport);
router.get('/expenses', getExpensesReport);
router.get('/owner-equity', getOwnerEquity);
router.get('/trial-balance', getTrialBalance);
router.get('/general-ledger', getGeneralLedger);
router.get('/comparative', getComparative);
router.get('/summary', getReportSummary);

export default router;
