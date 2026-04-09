/**
 * Order Controller
 * Handles order endpoints
 * SENIOR FIX: Added OrderRepository import for real-time deletion
 */

const OrderService = require('../services/OrderService');
const OrderRepository = require('../repositories/OrderRepository');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const { getClientIp, getUserAgent } = require('../middlewares/loggerMiddleware');
const { emitUpdate, emitAdminUpdate, emitAdminNotification } = require('../utils/socket');

class OrderController {
    // Create order
    async createOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            console.log('OrderController.createOrder - User:', userId);
            console.log('OrderController.createOrder - Request body:', JSON.stringify(req.body, null, 2));

            const order = await OrderService.createOrder(userId, req.body, ipAddress, userAgent);
            console.log("ORDER:", order);
            console.log('OrderController.createOrder - Success, returning order:', order.orderId);

            // SENIOR FIX: Emit socket events for real-time KDS updates
            console.log(`[Event Emission] New Order Created:`);
            console.log(`  Order ID: ${order.orderId}`);

            // Handle both single-item and multi-item orders
            let orderSummary;
            if (order.items && order.items.length > 1) {
                // Multi-item order
                console.log(`  Items: ${order.items.length} products`);
                orderSummary = {
                    orderId: order.orderId,
                    _id: order._id,
                    userId: userId.toString(),
                    items: order.items,
                    itemCount: order.items.length,
                    totalAmount: order.totalAmount,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt,
                };
            } else {
                // Single-item order (backward compatibility)
                console.log(`  Product: ${order.quantity}x ${order.productName}`);
                orderSummary = {
                    orderId: order.orderId,
                    _id: order._id,
                    userId: userId.toString(),
                    productName: order.productName,
                    productDescription: order.productDescription,
                    quantity: order.quantity,
                    price: order.price,
                    totalAmount: order.totalAmount,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt,
                };
            }

            console.log(`  Status: ${order.status}`);

            // Emit to all admins for real-time KDS display
            emitAdminUpdate('orderCreated', orderSummary);

            console.log(`✓ Socket event 'orderCreated' emitted to all admins`);

            return sendSuccess(res, 201, 'Order created successfully', order);
        } catch (error) {
            console.error('OrderController.createOrder - Error caught:', error.message);
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
                console.log("FILTER:", filters)
            }

            const result = await OrderService.getUserOrders(
                userId,
                parseInt(page),
                parseInt(limit),
                filters
            );
            console.log("RESULT:", result)
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

            // Get user ID as string for socket emit
            const userIdStr = cancelledOrder.userId && cancelledOrder.userId._id
                ? cancelledOrder.userId._id.toString()
                : cancelledOrder.userId.toString();

            console.log(`[Event Emission] Order Cancellation:`);
            console.log(`  Order ID: ${cancelledOrder.orderId}`);
            console.log(`  User ID: ${userIdStr}`);
            console.log(`  Cancelled By: ${userRole}`);
            console.log(`  Reason: ${cancellationReason}`);

            // Emit real-time update to user
            emitUpdate(userIdStr, 'orderCancelled', {
                orderId: cancelledOrder.orderId,
                _id: cancelledOrder._id,
                status: cancelledOrder.status,
                message: `Your order has been cancelled. Reason: ${cancellationReason}`,
                updatedAt: cancelledOrder.updatedAt,
            });

            // Notify admin panel with comprehensive data
            emitAdminUpdate('orderCancelled', {
                orderId: cancelledOrder.orderId,
                _id: cancelledOrder._id,
                userId: userIdStr,
                cancelledBy: userRole,
                reason: cancellationReason,
                status: cancelledOrder.status,
                timestamp: new Date(),
            });

            console.log(`✓ Order cancelled: ${cancelledOrder.orderId} by ${userRole}`);

            return sendSuccess(res, 200, 'Order cancelled successfully', cancelledOrder);
        } catch (error) {
            return next(error);
        }
    }

    // Get all orders (admin only)
    async getAllOrders(req, res, next) {
        try {
            const { page = 1, limit = 10, status = null, ...filters } = req.query;
            const search = req.query.search || null;

            const orderFilters = { ...filters };
            // Only add status filter if it's provided and not 'all'
            if (status && status !== 'all') {
                orderFilters.status = status;
            }

            const result = await OrderService.getAllOrders(
                parseInt(page),
                parseInt(limit),
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

            // SENIOR FIX: Validate admin role
            if (!adminRole || !['admin', 'super-admin'].includes(adminRole)) {
                console.error(`Invalid admin role attempting order update: ${adminRole}`);
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

            // Get user ID as string for socket emit
            const userIdStr = updatedOrder.userId && updatedOrder.userId._id
                ? updatedOrder.userId._id.toString()
                : updatedOrder.userId.toString();

            console.log(`\n📡 SOCKET EMISSION START`);
            console.log(`Emitting Status: ${updatedOrder.status}`);

            // Emit real-time update to the user who owns the order
            emitUpdate(userIdStr, 'orderStatusUpdate', {
                orderId: updatedOrder.orderId,
                _id: updatedOrder._id,
                status: updatedOrder.status,
                message: `Your order status has been updated to ${updatedOrder.status}`,
                updatedAt: updatedOrder.updatedAt,
                updatedBy: adminRole,
            });

            console.log(`✓ Emitted to user: ${userIdStr}`);

            // Emit update to admin panel for real-time visibility
            emitAdminUpdate('orderStatusUpdated', {
                orderId: updatedOrder.orderId,
                _id: updatedOrder._id,
                status: updatedOrder.status,
                userId: userIdStr,
                updatedAt: updatedOrder.updatedAt,
                updatedByAdmin: adminId.toString(),
                adminRole: adminRole,
            });

            console.log(`✓ Order status updated: ${updatedOrder.orderId} -> ${status} (by ${adminRole})`);

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

            // SENIOR FIX: Get order details before deletion for socket emission
            const order = await OrderRepository.findById(orderId).catch(() => null);

            await OrderService.deleteOrder(orderId, adminId, ipAddress, userAgent);

            // Emit deletion event to admin panel
            if (order) {
                const userIdStr = order.userId && order.userId._id
                    ? order.userId._id.toString()
                    : order.userId.toString();

                console.log(`[Event Emission] Order Deletion:`);
                console.log(`  Order ID: ${order.orderId}`);
                console.log(`  User ID: ${userIdStr}`);
                console.log(`  Deleted By: super-admin`);

                emitAdminUpdate('orderDeleted', {
                    orderId: order.orderId,
                    _id: order._id,
                    userId: userIdStr,
                    deletedBy: 'super-admin',
                    timestamp: new Date(),
                });

                console.log(`✓ Order deleted: ${order.orderId}`);
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

            console.log(`[Bulk Update Socket Emit] Starting bulk order update emissions...`);
            console.log(`  Total orders affected: ${result.updated}`);
            console.log(`  New status: ${status}`);

            // SENIOR FIX: Emit socket updates for each affected order
            if (result.orders && Array.isArray(result.orders)) {
                result.orders.forEach(order => {
                    try {
                        const userIdStr = order.userId && order.userId._id
                            ? order.userId._id.toString()
                            : order.userId.toString();

                        // Notify individual user of status change
                        emitUpdate(userIdStr, 'orderStatusUpdate', {
                            orderId: order.orderId,
                            _id: order._id,
                            status: order.status,
                            message: `Your order status has been updated to ${order.status}`,
                            updatedAt: order.updatedAt,
                            updatedBy: adminRole,
                        });

                        // SENIOR FIX: Also emit to admin panel for each order
                        // This allows real-time individual order updates instead of just summary
                        emitAdminUpdate('orderStatusUpdated', {
                            orderId: order.orderId,
                            _id: order._id,
                            status: order.status,
                            userId: userIdStr,
                            updatedAt: order.updatedAt,
                            updatedByAdmin: adminId.toString(),
                            adminRole: adminRole,
                            isBulkUpdate: true,
                        });

                        console.log(`  ✓ Emitted updates for order ${order.orderId}`);
                    } catch (error) {
                        console.error(`Error emitting update for order ${order._id}:`, error.message);
                    }
                });
            }

            // Emit summary to admin panel as well
            emitAdminUpdate('bulkOrderStatusUpdated', {
                total: result.total,
                updated: result.updated,
                status: result.status,
                updatedByAdmin: adminId.toString(),
                adminRole: adminRole,
                timestamp: new Date(),
            });

            console.log(`✓ Bulk order update completed: ${result.updated}/${result.total} orders -> ${status}`);

            return sendSuccess(res, 200, 'Bulk update completed', result);
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

            const userIdStr = updatedOrder.userId?._id
                ? updatedOrder.userId._id.toString()
                : updatedOrder.userId.toString();

            // Notify the customer their order was updated
            emitUpdate(userIdStr, 'orderItemsAppended', {
                orderId: updatedOrder.orderId,
                _id: updatedOrder._id,
                items: updatedOrder.items,
                totalAmount: updatedOrder.totalAmount,
                deltaItems,
                message: `${deltaItems.length} item(s) were added to your order`,
                updatedAt: updatedOrder.updatedAt,
            });

            // Notify all admins / KDS
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

            console.log(`✓ Items appended to order ${updatedOrder.orderId}: ${deltaItems.length} delta item(s)`);

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
                parseInt(limit)
            );

            return sendSuccess(res, 200, 'Search results retrieved', result.orders, result.pagination);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = new OrderController();
