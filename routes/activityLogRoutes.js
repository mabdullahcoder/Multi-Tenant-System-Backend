/**
 * Activity Log Routes
 */

const express = require('express');
const router = express.Router();
const ActivityLogController = require('../controllers/ActivityLogController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/authorizationMiddleware');

// Admin-only routes
router.get(
    '/',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ActivityLogController.getAllActivityLogs(req, res, next)
);

router.get(
    '/user/:userId',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ActivityLogController.getUserActivityLogs(req, res, next)
);

router.get(
    '/user/:userId/login-history',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ActivityLogController.getUserLoginHistory(req, res, next)
);

router.get(
    '/date-range',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ActivityLogController.getLogsByDateRange(req, res, next)
);

router.get(
    '/stats',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => ActivityLogController.getActivityStats(req, res, next)
);

module.exports = router;
