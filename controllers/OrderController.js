/**
 * Order Controller
 * Handles order endpoints
 */

const OrderService = require('../services/OrderService');
const OrderRepository = require('../repositories/OrderRepository');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const { getClientIp, getUserAgent } = require('../middlewares/loggerMiddleware');
const { emitUpdate, emitAdminUpdate } = require('../utils/socket');
const logger = require('../utils/logger');

/**
 * Build a normalised order summary for socket emission.
 * Works for both multi-item and legacy single-item orders.
 */
const buildOrderSummary = (order, userId) => {
    const base = {
        orderId: order.orderId,
        _id: order._id,
        userId: userId.toString(),
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    };

    if (order.items && order.items.length > 0) {
        return { ...base, items: order.items, itemCount: order.items.length };
    }

    return {
        ...base,
        productName: order.productName,
        productDescription: order.productDescription,
        quantity: order.quantity,
        price: order.price,
    };
};

/**
 * Safely extract a string user ID from a populated or raw userId field.
 */
const extractUserIdStr = (order) =>
    order.userId?._id?.toString() ?? order.userId?.toString() ?? null;

class OrderController {
    // Create order
    async createOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const order = await OrderService.createOrder(userId, req.body, ipAddress, userAgent);

            const orderSummary = buildOrderSummary(order, userId);
            emitAdminUpdate('orderCreated', orderSummary);
            logger.info(`Order created: ${order.orderId} by user ${userId}`);

            return sendSuccess(res, 201, 'Order created successfully', order);
        } catch (error) {
            return next(error);
        }
    }

    // Get user orders
    async getUserOrders(req, res, next) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10, status = null } = req.query;

            const filters = {};
            if (status && status !== 'all') {
                filters.status = status;
            }

            const result = await OrderService.getUserOrders(
                userId,
                parseInt(page),
                Math.min(parseInt(limit), 100),
                filters
            );
            return sendSuccess(res, 200, 'Orders retrieved successfully', result.orders, result.pagination);
        } catch (error) {
            return next(error);
        }
    }

    // Get order details
    async getOrderDetail(req, res, next) {
        try {
            const { orderId } = req.params;
            const userId = req.user.id;
            const userRole = req.user.role;

            const order = await OrderService.getOrderDetails(orderId, userId, userRole);
            return sendSuccess(res, 200, 'Order details retrieved', order);
        } catch (error) {
            return next(error);
        }
    }

    // Cancel order
    async cancelOrder(req, res, next) {
        try {
            const { orderId } = req.params;
            const { cancellationReason } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const cancelledOrder = await OrderService.cancelOrder(
                orderId,
                userId,
                userRole,
                cancellationReason,
                ipAddress,
                userAgent
            );

            const userIdStr = extractUserIdStr(cancelledOrder);

            emitUpdate(userIdStr, 'orderCancelled', {
                orderId: cancelledOrder.orderId,
                _id: cancelledOrder._id,
                status: cancelledOrder.status,
                message: `Your order has been cancelled. Reason: ${cancellationReason}`,
                updatedAt: cancelledOrder.updatedAt,
            });

            emitAdminUpdate('orderCancelled', {
                orderId: cancelledOrder.orderId,
                _id: cancelledOrder._id,
                userId: userIdStr,
                cancelledBy: userRole,
                reason: cancellationReason,
                status: cancelledOrder.status,
                timestamp: new Date(),
            });

            logger.info(`Order cancelled: ${cancelledOrder.orderId} by ${userRole}`);
            return sendSuccess(res, 200, 'Order cancelled successfully', cancelledOrder);
        } catch (error) {
            return next(error);
        }
    }

    // Get all orders (admin only)
    async getAllOrders(req, res, next) {
        try {
            const { page = 1, limit = 10, status = null, search = null, ...rest } = req.query;

            const orderFilters = { ...rest };
            if (status && status !== 'all') {
                orderFilters.status = status;
            }

            const result = await OrderService.getAllOrders(
                parseInt(page),
                Math.min(parseInt(limit), 100),
                orderFilters,
                search
            );

            return sendSuccess(res, 200, 'Orders retrieved successfully', result.orders, result.pagination);
        } catch (error) {
            return next(error);
        }
    }

    // Update order status (admin only)
    async updateOrderStatus(req, res, next) {
        try {
            const { orderId } = req.params;
            const { status } = req.body;
            const adminId = req.user.id;
            const adminRole = req.user.role;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            if (!['admin', 'super-admin'].includes(adminRole)) {
                return sendError(res, 403, 'Invalid admin role');
            }

            if (!status) {
                return sendError(res, 400, 'Status is required');
            }

            const updatedOrder = await OrderService.updateOrderStatus(
                orderId,
                status,
                adminId,
                adminRole,
                ipAddress,
                userAgent
            );

            const userIdStr = extractUserIdStr(updatedOrder);

            emitUpdate(userIdStr, 'orderStatusUpdate', {
                orderId: updatedOrder.orderId,
                _id: updatedOrder._id,
                status: updatedOrder.status,
                message: `Your order status has been updated to ${updatedOrder.status}`,
                updatedAt: updatedOrder.updatedAt,
                updatedBy: adminRole,
            });

            emitAdminUpdate('orderStatusUpdated', {
                orderId: updatedOrder.orderId,
                _id: updatedOrder._id,
                status: updatedOrder.status,
                userId: userIdStr,
                updatedAt: updatedOrder.updatedAt,
                confirmedAt: updatedOrder.confirmedAt ?? null,
                updatedByAdmin: adminId.toString(),
                adminRole,
            });

            logger.info(`Order status updated: ${updatedOrder.orderId} → ${status} by ${adminRole}`);
            return sendSuccess(res, 200, 'Order status updated successfully', updatedOrder);
        } catch (error) {
            return next(error);
        }
    }

    // Get order statistics (admin only)
    async getOrderStats(req, res, next) {
        try {
            const stats = await OrderService.getOrderStats();
            return sendSuccess(res, 200, 'Order statistics retrieved', stats);
        } catch (error) {
            return next(error);
        }
    }

    // Delete order (super admin only)
    async deleteOrder(req, res, next) {
        try {
            const { orderId } = req.params;
            const adminId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            // Fetch before deletion so we can emit the socket event
            const order = await OrderRepository.findById(orderId).catch(() => null);

            await OrderService.deleteOrder(orderId, adminId, ipAddress, userAgent);

            if (order) {
                const userIdStr = extractUserIdStr(order);
                emitAdminUpdate('orderDeleted', {
                    orderId: order.orderId,
                    _id: order._id,
                    userId: userIdStr,
                    deletedBy: 'super-admin',
                    timestamp: new Date(),
                });
                logger.info(`Order deleted: ${order.orderId} by super-admin ${adminId}`);
            }

            return sendSuccess(res, 200, 'Order deleted successfully');
        } catch (error) {
            return next(error);
        }
    }

    // Bulk update status (admin only)
    async bulkUpdateOrderStatus(req, res, next) {
        try {
            const { orderIds, status } = req.body;
            const adminId = req.user.id;
            const adminRole = req.user.role;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
                return sendError(res, 400, 'A non-empty array of order IDs is required.');
            }

            const result = await OrderService.bulkUpdateOrderStatus(
                orderIds,
                status,
                adminId,
                adminRole,
                ipAddress,
                userAgent
            );

            // Emit per-order socket updates
            if (result.orders && Array.isArray(result.orders)) {
                result.orders.forEach((order) => {
                    try {
                        const userIdStr = extractUserIdStr(order);

                        emitUpdate(userIdStr, 'orderStatusUpdate', {
                            orderId: order.orderId,
                            _id: order._id,
                            status: order.status,
                            message: `Your order status has been updated to ${order.status}`,
                            updatedAt: order.updatedAt,
                            updatedBy: adminRole,
                        });

                        emitAdminUpdate('orderStatusUpdated', {
                            orderId: order.orderId,
                            _id: order._id,
                            status: order.status,
                            userId: userIdStr,
                            updatedAt: order.updatedAt,
                            updatedByAdmin: adminId.toString(),
                            adminRole,
                            isBulkUpdate: true,
                        });
                    } catch (emitErr) {
                        logger.error(`Error emitting bulk update for order ${order._id}: ${emitErr.message}`);
                    }
                });
            }

            emitAdminUpdate('bulkOrderStatusUpdated', {
                total: result.total,
                updated: result.updated,
                status: result.status,
                updatedByAdmin: adminId.toString(),
                adminRole,
                timestamp: new Date(),
            });

            logger.info(`Bulk status update: ${result.updated}/${result.total} orders → ${status} by ${adminRole}`);
            return sendSuccess(res, 200, 'Bulk update completed', result);
        } catch (error) {
            return next(error);
        }
    }

    // Update order items (admin only) — replaces the full items list
    async updateOrderItems(req, res, next) {
        try {
            const { orderId } = req.params;
            const { items } = req.body;
            const adminId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            if (!items || !Array.isArray(items) || items.length === 0) {
                return sendError(res, 400, 'A non-empty items array is required');
            }

            const updatedOrder = await OrderService.updateOrderItems(
                orderId,
                items,
                adminId,
                ipAddress,
                userAgent
            );

            const userIdStr = extractUserIdStr(updatedOrder);

            if (userIdStr) {
                emitUpdate(userIdStr, 'orderItemsUpdated', {
                    orderId: updatedOrder.orderId,
                    _id: updatedOrder._id,
                    items: updatedOrder.items,
                    totalAmount: updatedOrder.totalAmount,
                    message: 'Your order has been updated',
                    updatedAt: updatedOrder.updatedAt,
                });
            }

            emitAdminUpdate('orderItemsUpdated', {
                orderId: updatedOrder.orderId,
                _id: updatedOrder._id,
                userId: userIdStr,
                items: updatedOrder.items,
                totalAmount: updatedOrder.totalAmount,
                updatedAt: updatedOrder.updatedAt,
                updatedByAdmin: adminId.toString(),
            });

            return sendSuccess(res, 200, 'Order items updated successfully', updatedOrder);
        } catch (error) {
            return next(error);
        }
    }

    // Append items to a confirmed order (admin only)
    async appendItemsToOrder(req, res, next) {
        try {
            const { orderId } = req.params;
            const { items } = req.body;
            const adminId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            if (!items || !Array.isArray(items) || items.length === 0) {
                return sendError(res, 400, 'A non-empty items array is required');
            }

            const { updatedOrder, deltaItems } = await OrderService.appendItemsToOrder(
                orderId,
                items,
                adminId,
                ipAddress,
                userAgent
            );

            const userIdStr = extractUserIdStr(updatedOrder);

            if (userIdStr) {
                emitUpdate(userIdStr, 'orderItemsAppended', {
                    orderId: updatedOrder.orderId,
                    _id: updatedOrder._id,
                    items: updatedOrder.items,
                    totalAmount: updatedOrder.totalAmount,
                    deltaItems,
                    message: `${deltaItems.length} item(s) were added to your order`,
                    updatedAt: updatedOrder.updatedAt,
                });
            }

            emitAdminUpdate('orderItemsAppended', {
                orderId: updatedOrder.orderId,
                _id: updatedOrder._id,
                userId: userIdStr,
                items: updatedOrder.items,
                totalAmount: updatedOrder.totalAmount,
                deltaItems,
                updatedAt: updatedOrder.updatedAt,
                updatedByAdmin: adminId.toString(),
            });

            logger.info(`Items appended to order ${updatedOrder.orderId}: ${deltaItems.length} delta item(s)`);
            return sendSuccess(res, 200, 'Items appended to order successfully', updatedOrder);
        } catch (error) {
            return next(error);
        }
    }

    // Advanced search (admin only)
    async searchOrdersAdvanced(req, res, next) {
        try {
            const { page = 1, limit = 10, ...searchParams } = req.query;

            const result = await OrderService.searchOrdersAdvanced(
                searchParams,
                parseInt(page),
                Math.min(parseInt(limit), 100)
            );

            return sendSuccess(res, 200, 'Search results retrieved', result.orders, result.pagination);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = new OrderController();
