/**
 * Report Routes
 */

const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/authorizationMiddleware');

// IMPORTANT: Specific routes must be defined before dynamic /:id routes

// User routes - Generate report
router.post('/', authMiddleware, (req, res, next) => ReportController.generateReport(req, res, next));

// Specific endpoints (must come before /:reportId)
router.get('/my-reports', authMiddleware, (req, res, next) => ReportController.getUserReports(req, res, next));
router.get('/stats', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getReportStats(req, res, next));

// Legacy sales endpoints
router.get('/sales/summary', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getSalesSummary(req, res, next));
router.get('/sales/top-products', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getTopProducts(req, res, next));

// ─── COMPREHENSIVE ANALYTICS ENDPOINTS ───────────────────────────────────────
router.get('/analytics/kpi', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getKPIOverview(req, res, next));
router.get('/analytics/orders', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getOrdersAnalytics(req, res, next));
router.get('/analytics/menu', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getMenuAnalytics(req, res, next));
router.get('/analytics/payments', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getPaymentAnalytics(req, res, next));
router.get('/analytics/kitchen', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getKitchenAnalytics(req, res, next));
router.get('/analytics/export', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.exportAnalytics(req, res, next));
// ─────────────────────────────────────────────────────────────────────────────

// Detail/Download/Delete routes (dynamic - must come after static routes)
router.get('/:reportId/download', authMiddleware, (req, res, next) => ReportController.downloadReport(req, res, next));
router.get('/:reportId', authMiddleware, (req, res, next) => ReportController.getReportById(req, res, next));
router.delete('/:reportId', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.deleteReport(req, res, next));

// All reports (admin) - must be last GET /
router.get('/', authMiddleware, authorizeRoles('admin', 'super-admin'), (req, res, next) => ReportController.getAllReports(req, res, next));

module.exports = router;
