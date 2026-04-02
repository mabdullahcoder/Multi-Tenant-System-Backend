/**
 * Order Service
 * Handles order operations
 */

const OrderRepository = require('../repositories/OrderRepository');
const ActivityLog = require('../models/ActivityLog');
const AdminLog = require('../models/AdminLog');
const { validateInput, orderValidationSchemas } = require('../utils/validationSchemas');
const { canAccessResource } = require('../utils/authorizationHelper');

class OrderService {
    // Create order
    async createOrder(userId, orderData, ipAddress, userAgent) {
        try {
            console.log('OrderService.createOrder - Received data:', JSON.stringify(orderData, null, 2));

            // Validate input
            const validation = validateInput(orderValidationSchemas.createOrder, orderData);
            if (!validation.valid) {
                console.error('OrderService.createOrder - Validation failed:', validation.errors);
                const error = new Error('Validation failed');
                error.status = 400;
                error.errors = validation.errors;
                throw error;
            }

            console.log('OrderService.createOrder - Validation passed, creating order...');

            // Create order
            const order = await OrderRepository.create({
                userId,
                ...validation.data,
                status: 'pending',
                paymentStatus: 'pending',
            });

            console.log('OrderService.createOrder - Order created successfully:', order.orderId);

            // Log activity (non-blocking)
            setImmediate(() => {
                ActivityLog.create({
                    userId,
                    action: 'order_created',
                    actionDescription: `Order created: ${order.orderId}`,
                    resourceId: order._id,
                    resourceType: 'Order',
                    ipAddress,
                    userAgent,
                    status: 'success',
                }).catch(err => console.error('Activity log error:', err));
            });

            return order;
        } catch (error) {
            console.error('OrderService.createOrder error:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.status,
                errors: error.errors,
                stack: error.stack
            });
            throw error;
        }
    }

    // Get user orders
    async getUserOrders(userId, page = 1, limit = 10, filters = {}) {
        return await OrderRepository.getUserOrders(userId, page, limit, filters);
    }

    // Get order details
    async getOrderDetails(orderId, userId, userRole = 'user') {
        const order = await OrderRepository.findById(orderId);
        if (!order) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }

        // Check authorization: User can only see their own orders, admins can see all
        if (!canAccessResource(userRole, order.userId, userId)) {
            const error = new Error('You are not authorized to access this order.');
            error.status = 403;
            throw error;
        }

        return order;
    }

    // Update order status (admin only)
    async updateOrderStatus(orderId, status, adminId, adminRole = 'admin', ipAddress, userAgent) {
        const previousOrder = await OrderRepository.findById(orderId);
        if (!previousOrder) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }

        // Validate status transitions
        // Senior Developer Note: Standard flow is maintained for safety, 
        // but Super-Admins can bypass this for manual corrections.
        const validTransitions = {
            pending: ['confirmed', 'cancelled'],
            confirmed: ['shipped', 'cancelled'],
            shipped: ['delivered', 'cancelled'],
            delivered: [],
            cancelled: []
        };

        const isSuperAdmin = adminRole === 'super-admin';
        const allowedStatuses = validTransitions[previousOrder.status] || [];

        if (!isSuperAdmin && !allowedStatuses.includes(status)) {
            const error = new Error(
                `Invalid status transition from ${previousOrder.status} to ${status}. ` +
                `Allowed transitions: ${allowedStatuses.join(', ') || 'none'}`
            );
            error.status = 400;
            throw error;
        }

        // Prepare update data
        const updateData = { status };

        // Auto-set estimated delivery date when order is confirmed (3 days from now)
        if (status === 'confirmed' && !previousOrder.estimatedDeliveryDate) {
            const estimatedDate = new Date();
            estimatedDate.setDate(estimatedDate.getDate() + 3);
            updateData.estimatedDeliveryDate = estimatedDate;
        }

        // Auto-set actual delivery date when order is delivered
        if (status === 'delivered' && !previousOrder.actualDeliveryDate) {
            updateData.actualDeliveryDate = new Date();
        }

        // Update payment status to refunded when order is cancelled
        if (status === 'cancelled' && previousOrder.paymentStatus === 'completed') {
            updateData.paymentStatus = 'refunded';
        }

        const order = await OrderRepository.update(orderId, updateData);

        // Log admin activity
        await AdminLog.create({
            adminId,
            action: 'order_status_updated',
            actionDescription: `Order ${orderId} status changed from ${previousOrder.status} to ${status}`,
            targetResourceId: orderId,
            resourceType: 'Order',
            previousValue: { status: previousOrder.status },
            newValue: { status, ...updateData },
            ipAddress,
            userAgent,
        });

        // Log user activity
        await ActivityLog.create({
            userId: order.userId,
            action: 'order_status_changed',
            actionDescription: `Order ${order.orderId} status changed to ${status}`,
            resourceId: orderId,
            resourceType: 'Order',
            status: 'success',
        });

        return order;
    }

    // Cancel order
    async cancelOrder(orderId, userId, userRole, cancellationReason, ipAddress, userAgent) {
        const order = await OrderRepository.findById(orderId);
        if (!order) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }

        // Check authorization: User can cancel their own orders, admins can cancel any
        if (!canAccessResource(userRole, order.userId, userId)) {
            const error = new Error('You are not authorized to cancel this order.');
            error.status = 403;
            throw error;
        }

        // Check if order can be cancelled
        if (['delivered', 'cancelled'].includes(order.status)) {
            const error = new Error(`Cannot cancel order with status: ${order.status}`);
            error.status = 400;
            throw error;
        }

        // Determine who cancelled the order
        const cancelledBy = ['admin', 'super-admin'].includes(userRole) ? 'admin' : 'user';

        const cancelledOrder = await OrderRepository.cancelOrder(
            orderId,
            cancellationReason,
            cancelledBy
        );

        // Log activity
        await ActivityLog.create({
            userId: order.userId,
            action: 'order_cancelled',
            actionDescription: `Order ${cancellationReason} - cancelled by ${cancelledBy}`,
            resourceId: orderId,
            resourceType: 'Order',
            ipAddress,
            userAgent,
            status: 'success',
        });

        // Log admin activity if admin cancelled
        if (['admin', 'super-admin'].includes(userRole)) {
            await AdminLog.create({
                adminId: userId,
                action: 'order_cancelled',
                actionDescription: `Order ${orderId} cancelled by admin: ${cancellationReason}`,
                targetResourceId: orderId,
                resourceType: 'Order',
                ipAddress,
                userAgent,
            });
        }

        return cancelledOrder;
    }

    // Get all orders (admin only)
    async getAllOrders(page = 1, limit = 10, filters = {}, search = null) {
        if (search) {
            return await OrderRepository.searchOrders(search, page, limit);
        }
        return await OrderRepository.getAllOrders(page, limit, filters);
    }

    // Get order statistics (admin only)
    async getOrderStats() {
        return await OrderRepository.getOrderStats();
    }

    // Delete order (super admin only)
    async deleteOrder(orderId, adminId, ipAddress, userAgent) {
        const order = await OrderRepository.findById(orderId);
        if (!order) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }

        // Delete the order
        await OrderRepository.delete(orderId);

        // Log admin activity
        await AdminLog.create({
            adminId,
            action: 'order_deleted',
            actionDescription: `Order ${order.orderId} deleted permanently`,
            targetResourceId: orderId,
            resourceType: 'Order',
            previousValue: { order: order.toObject() },
            ipAddress,
            userAgent,
        });

        return { success: true };
    }
    // Bulk update order status (admin only)
    async bulkUpdateOrderStatus(orderIds, status, adminId, adminRole = 'admin', ipAddress, userAgent) {
        // Fetch existing orders to check current statuses
        const orders = await OrderRepository.findByQuery({ _id: { $in: orderIds } });

        // Filter out unreachable transitions if not super-admin
        const eligibleOrders = orders.orders.filter(order => {
            if (adminRole === 'super-admin') return true;
            const validTransitions = {
                pending: ['confirmed', 'cancelled'],
                confirmed: ['shipped', 'cancelled'],
                shipped: ['delivered', 'cancelled'],
                delivered: [],
                cancelled: []
            };
            const allowed = validTransitions[order.status] || [];
            return allowed.includes(status);
        });

        if (eligibleOrders.length === 0) {
            const error = new Error('No eligible orders found for this status transition.');
            error.status = 400;
            throw error;
        }

        const eligibleIds = eligibleOrders.map(o => o._id);
        const updateData = { status };

        // Auto-set dates as per status logic
        if (status === 'confirmed') {
            const estimatedDate = new Date();
            estimatedDate.setDate(estimatedDate.getDate() + 3);
            updateData.estimatedDeliveryDate = estimatedDate;
        }
        if (status === 'delivered') updateData.actualDeliveryDate = new Date();
        if (status === 'cancelled') updateData.paymentStatus = 'refunded';

        // Update orders and return them
        await OrderRepository.updateMany({ _id: { $in: eligibleIds } }, updateData);

        // Fetch updated orders to return
        const updatedOrders = await OrderRepository.findByQuery({ _id: { $in: eligibleIds } });

        // Bulk log admin activity
        await AdminLog.create({
            adminId,
            action: 'order_bulk_status_updated',
            actionDescription: `Bulk status update to ${status} for ${eligibleIds.length} orders`,
            targetResourceId: 'multiple',
            resourceType: 'Order',
            newValue: { status, orderIds: eligibleIds },
            ipAddress,
            userAgent,
        });

        // Bulk log user activities
        const activityLogPromises = eligibleOrders.map(order =>
            ActivityLog.create({
                userId: order.userId,
                action: 'order_status_changed',
                actionDescription: `Order ${order.orderId} status changed to ${status}`,
                resourceId: order._id,
                resourceType: 'Order',
                status: 'success',
            })
        );
        await Promise.all(activityLogPromises);

        return {
            total: orderIds.length,
            updated: eligibleIds.length,
            status,
            orders: updatedOrders.orders // Return updated orders for socket emission
        };
    }

    // Advanced search
    async searchOrdersAdvanced(params, page = 1, limit = 10) {
        const { query, startDate, endDate, minAmount, maxAmount, status } = params;
        const mongooseQuery = {};

        if (query) {
            mongooseQuery.$or = [
                { orderId: { $regex: query, $options: 'i' } },
                { productName: { $regex: query, $options: 'i' } }
            ];
        }

        if (status && status !== 'all') {
            mongooseQuery.status = status;
        }

        if (startDate || endDate) {
            mongooseQuery.createdAt = {};
            if (startDate) mongooseQuery.createdAt.$gte = new Date(startDate);
            if (endDate) mongooseQuery.createdAt.$lte = new Date(endDate);
        }

        if (minAmount || maxAmount) {
            mongooseQuery.totalAmount = {};
            if (minAmount) mongooseQuery.totalAmount.$gte = parseFloat(minAmount);
            if (maxAmount) mongooseQuery.totalAmount.$lte = parseFloat(maxAmount);
        }

        return await OrderRepository.findByQuery(mongooseQuery, page, limit);
    }
}

module.exports = new OrderService();
