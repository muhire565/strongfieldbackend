import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as financeController from '../controllers/finance.controller.js';

const router = Router();

router.use(authenticate);

// Balances
router.get('/balances', financeController.getBalances);

// Capital
router.get('/capital', financeController.listCapital);
router.post('/capital', authorize('admin'), financeController.injectCapital);

// Expenses
router.get('/expenses', financeController.listExpenses);
router.post('/expenses', authorize('admin'), financeController.recordExpense);
router.get('/expenses/:id', financeController.getExpenseDetail);

// Withdrawals
router.get('/withdrawals', financeController.listWithdrawals);
router.post('/withdrawals', authorize('admin'), financeController.recordWithdrawal);
router.get('/withdrawals/:id', financeController.getWithdrawalDetail);

// Goods Purchases
router.get('/purchases', financeController.listPurchases);
router.post('/purchases', authorize('admin'), financeController.recordPurchase);
router.get('/purchases/:id', financeController.getPurchaseDetail);

// Transactions Ledger
router.get('/transactions', financeController.listTransactions);
router.get('/transactions/:id', financeController.getTransactionDetail);

// Summary & Reports
router.get('/summary', financeController.getSummary);
router.get('/cashflow', financeController.getCashflow);

export default router;
