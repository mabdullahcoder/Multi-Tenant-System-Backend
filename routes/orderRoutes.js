/**
 * Order Routes
 */

const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/authorizationMiddleware');

// IMPORTANT: Specific routes must be defined before dynamic /:id routes

// User routes - Create order
router.post(
    '/',
    authMiddleware,
    authorizeRoles('user', 'admin', 'super-admin'),
    (req, res, next) => OrderController.createOrder(req, res, next)
);

// Specific endpoints (must come before /:orderId)
router.get(
    '/my-orders',
    authMiddleware,
    (req, res, next) => OrderController.getUserOrders(req, res, next)
);

router.get(
    '/stats',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => OrderController.getOrderStats(req, res, next)
);

// Advanced Search (Filter by date, amount, etc.)
router.get(
    '/search',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => OrderController.searchOrdersAdvanced(req, res, next)
);

// Bulk updates
router.patch(
    '/bulk-status',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => OrderController.bulkUpdateOrderStatus(req, res, next)
);

// Detail/Cancel routes
router.get(
    '/detail/:orderId',
    authMiddleware,
    (req, res, next) => OrderController.getOrderDetail(req, res, next)
);

router.patch(
    '/:orderId/cancel',
    authMiddleware,
    (req, res, next) => OrderController.cancelOrder(req, res, next)
);

router.put(
    '/:orderId/status',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => OrderController.updateOrderStatus(req, res, next)
);

// Update (replace) all items on an existing order (admin only)
router.put(
    '/:orderId/update-items',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => OrderController.updateOrderItems(req, res, next)
);

// Append items to a confirmed order (admin only)
router.patch(
    '/:orderId/append-items',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => OrderController.appendItemsToOrder(req, res, next)
);

// Admin routes - Get all orders (generic, must be last)
router.get(
    '/',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => OrderController.getAllOrders(req, res, next)
);

// Delete order (super admin only)
router.delete(
    '/:orderId',
    authMiddleware,
    authorizeRoles('super-admin'),
    (req, res, next) => OrderController.deleteOrder(req, res, next)
);

module.exports = router;
