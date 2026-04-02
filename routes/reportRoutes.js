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
router.post(
    '/',
    authMiddleware,
    (req, res, next) => ReportController.generateReport(req, res, next)
);

// Specific endpoints (must come before /:reportId)
router.get(
    '/my-reports',
    authMiddleware,
    (req, res, next) => ReportController.getUserReports(req, res, next)
);

router.get(
    '/stats',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ReportController.getReportStats(req, res, next)
);

// Sales Analytics Summary
router.get(
    '/sales/summary',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ReportController.getSalesSummary(req, res, next)
);

// Top Selling Products
router.get(
    '/sales/top-products',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ReportController.getTopProducts(req, res, next)
);

// Detail/Download routes
router.get(
    '/:reportId/download',
    authMiddleware,
    (req, res, next) => ReportController.downloadReport(req, res, next)
);

router.get(
    '/:reportId',
    authMiddleware,
    (req, res, next) => ReportController.getReportById(req, res, next)
);

// Admin routes - Delete report
router.delete(
    '/:reportId',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ReportController.deleteReport(req, res, next)
);

// Admin routes - Get all reports (generic, must be last)
router.get(
    '/',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ReportController.getAllReports(req, res, next)
);

module.exports = router;
