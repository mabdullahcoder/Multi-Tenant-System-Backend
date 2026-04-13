/**
 * Order Service
 * Handles order business logic
 */

const OrderRepository = require('../repositories/OrderRepository');
const ActivityLog = require('../models/ActivityLog');
const AdminLog = require('../models/AdminLog');
const { validateInput, orderValidationSchemas } = require('../utils/validationSchemas');
const { canAccessResource } = require('../utils/authorizationHelper');
const logger = require('../utils/logger');

class OrderService {
    // Create order — supports both single-item (legacy) and multi-item orders
    async createOrder(userId, orderData, ipAddress, userAgent) {
        const validation = validateInput(orderValidationSchemas.createOrder, orderData);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.status = 400;
            error.errors = validation.errors;
            throw error;
        }

        const preparedData = {
            userId,
            deliveryAddress: validation.data.deliveryAddress,
            notes: validation.data.notes || null,
            status: 'pending',
            paymentStatus: 'pending',
            paymentMethod: validation.data.paymentMethod || 'credit_card',
        };

        if (validation.data.items && Array.isArray(validation.data.items) && validation.data.items.length > 0) {
            preparedData.items = validation.data.items;
            preparedData.totalAmount = validation.data.items.reduce(
                (sum, item) => sum + (item.subtotal ?? item.price * item.quantity),
                0
            );
        } else {
            // Legacy single-item order
            preparedData.productName = validation.data.productName;
            preparedData.productDescription = validation.data.productDescription || '';
            preparedData.quantity = validation.data.quantity;
            preparedData.price = validation.data.price;
            preparedData.totalAmount = validation.data.totalAmount;
        }

        const order = await OrderRepository.create(preparedData);

        // Log activity non-blocking
        setImmediate(() => {
            const itemsDesc = order.items?.length > 0
                ? `${order.items.length} item(s)`
                : order.productName;

            ActivityLog.create({
                userId,
                action: 'order_created',
                actionDescription: `Order created: ${order.orderId} (${itemsDesc})`,
                resourceId: order._id,
                resourceType: 'Order',
                ipAddress,
                userAgent,
                status: 'success',
            }).catch((err) => logger.error(`Activity log error: ${err.message}`));
        });

        return order;
    }

    // Get user orders
    async getUserOrders(userId, page = 1, limit = 10, filters = {}) {
        return await OrderRepository.getUserOrders(userId, page, limit, filters);
    }

    // Get order details
    async getOrderDetails(orderId, userId, userRole = 'user') {
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
        const order = isObjectId
            ? await OrderRepository.findById(orderId)
            : await OrderRepository.findByOrderId(orderId);

        if (!order) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }

        if (!canAccessResource(userRole, order.userId, userId)) {
            const error = new Error('You are not authorized to access this order.');
            error.status = 403;
            throw error;
        }

        return order;
    }

    // Update order status (admin only)
    async updateOrderStatus(orderId, status, adminId, adminRole = 'admin', ipAddress, userAgent) {
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
        const previousOrder = isObjectId
            ? await OrderRepository.findById(orderId)
            : await OrderRepository.findByOrderId(orderId);

        if (!previousOrder) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }

        const dbId = previousOrder._id.toString();

        const validTransitions = {
            pending: ['confirmed', 'cancelled'],
            confirmed: ['shipped', 'delivered', 'cancelled'],
            shipped: ['delivered', 'cancelled'],
            delivered: [],
            cancelled: [],
        };

        const isSuperAdmin = adminRole === 'super-admin';
        const allowedStatuses = validTransitions[previousOrder.status] || [];

        if (!isSuperAdmin && !allowedStatuses.includes(status)) {
            const error = new Error(
                `Invalid status transition from ${previousOrder.status} to ${status}. ` +
                `Allowed: ${allowedStatuses.join(', ') || 'none'}`
            );
            error.status = 400;
            throw error;
        }

        const updateData = { status };

        if (status === 'confirmed' && !previousOrder.estimatedDeliveryDate) {
            const estimatedDate = new Date();
            estimatedDate.setDate(estimatedDate.getDate() + 3);
            updateData.estimatedDeliveryDate = estimatedDate;
        }

        if (status === 'confirmed' && !previousOrder.confirmedAt) {
            updateData.confirmedAt = new Date();
        }

        if (status === 'delivered' && !previousOrder.actualDeliveryDate) {
            updateData.actualDeliveryDate = new Date();
        }

        if (status === 'cancelled' && previousOrder.paymentStatus === 'completed') {
            updateData.paymentStatus = 'refunded';
        }

        const order = await OrderRepository.update(dbId, updateData);

        // Log admin activity
        await AdminLog.create({
            adminId,
            action: 'order_status_updated',
            actionDescription: `Order ${previousOrder.orderId} status changed from ${previousOrder.status} to ${status}`,
            targetResourceId: previousOrder._id,
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
            resourceId: order._id,
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

        if (!canAccessResource(userRole, order.userId, userId)) {
            const error = new Error('You are not authorized to cancel this order.');
            error.status = 403;
            throw error;
        }

        if (['delivered', 'cancelled'].includes(order.status)) {
            const error = new Error(`Cannot cancel order with status: ${order.status}`);
            error.status = 400;
            throw error;
        }

        const cancelledBy = ['admin', 'super-admin'].includes(userRole) ? 'admin' : 'user';

        const cancelledOrder = await OrderRepository.cancelOrder(
            orderId,
            cancellationReason,
            cancelledBy
        );

        await ActivityLog.create({
            userId: order.userId,
            action: 'order_cancelled',
            actionDescription: `Order ${order.orderId} cancelled by ${cancelledBy}: ${cancellationReason}`,
            resourceId: orderId,
            resourceType: 'Order',
            ipAddress,
            userAgent,
            status: 'success',
        });

        if (['admin', 'super-admin'].includes(userRole)) {
            await AdminLog.create({
                adminId: userId,
                action: 'order_cancelled',
                actionDescription: `Order ${order.orderId} cancelled by admin: ${cancellationReason}`,
                targetResourceId: order._id,
                resourceType: 'Order',
                ipAddress,
                userAgent,
            });
        }

        return cancelledOrder;
    }

    /**
     * Append items to a confirmed/pending order (admin only).
     * Computes the diff between incoming full item list and existing items,
     * then pushes only net-new / increased-quantity items to the DB.
     */
    async appendItemsToOrder(orderId, incomingItems, adminId, ipAddress, userAgent) {
        const { validateInput, appendItemsSchema } = require('../utils/validationSchemas');

        const validation = validateInput(appendItemsSchema, { items: incomingItems });
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.status = 400;
            error.errors = validation.errors;
            throw error;
        }

        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
        const order = isObjectId
            ? await OrderRepository.findById(orderId)
            : await OrderRepository.findByOrderId(orderId);

        if (!order) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }

        if (!['confirmed', 'pending'].includes(order.status)) {
            const error = new Error(`Cannot add items to an order with status: ${order.status}`);
            error.status = 400;
            throw error;
        }

        const existingItems = Array.isArray(order.items) ? order.items : [];

        const existingMap = existingItems.reduce((map, item) => {
            const key = item.productName.toLowerCase().trim();
            map[key] = (map[key] || 0) + item.quantity;
            return map;
        }, {});

        const deltaItems = [];
        for (const incoming of validation.data.items) {
            const key = incoming.productName.toLowerCase().trim();
            const existingQty = existingMap[key] || 0;
            const deltaQty = incoming.quantity - existingQty;

            if (deltaQty > 0) {
                deltaItems.push({
                    productId: incoming.productId || null,
                    productName: incoming.productName,
                    productDescription: incoming.productDescription || '',
                    quantity: deltaQty,
                    price: incoming.price,
                    subtotal: incoming.price * deltaQty,
                });
            }
        }

        if (deltaItems.length === 0) {
            const error = new Error('No new items to add — quantities match or are lower than existing order');
            error.status = 400;
            throw error;
        }

        const updatedOrder = await OrderRepository.appendItems(order._id.toString(), deltaItems);

        setImmediate(() => {
            AdminLog.create({
                adminId,
                action: 'order_items_appended',
                actionDescription: `${deltaItems.length} item(s) appended to order ${order.orderId}`,
                targetResourceId: order._id,
                resourceType: 'Order',
                previousValue: { itemCount: existingItems.length, totalAmount: order.totalAmount },
                newValue: { itemCount: updatedOrder.items.length, totalAmount: updatedOrder.totalAmount },
                ipAddress,
                userAgent,
            }).catch((err) => logger.error(`AdminLog error: ${err.message}`));

            ActivityLog.create({
                userId: order.userId,
                action: 'order_items_added',
                actionDescription: `${deltaItems.length} item(s) added to order ${order.orderId} by admin`,
                resourceId: order._id,
                resourceType: 'Order',
                status: 'success',
            }).catch((err) => logger.error(`ActivityLog error: ${err.message}`));
        });

        return { updatedOrder, deltaItems };
    }

    /**
     * Replace the full items list on an existing order.
     * Used by the admin edit-order flow where quantities can increase OR decrease.
     */
    async updateOrderItems(orderId, incomingItems, adminId, ipAddress, userAgent) {
        const { validateInput, updateItemsSchema } = require('../utils/validationSchemas');

        const validation = validateInput(updateItemsSchema, { items: incomingItems });
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.status = 400;
            error.errors = validation.errors;
            throw error;
        }

        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
        const order = isObjectId
            ? await OrderRepository.findById(orderId)
            : await OrderRepository.findByOrderId(orderId);

        if (!order) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }

        if (!['confirmed', 'pending'].includes(order.status)) {
            const error = new Error(`Cannot update items on an order with status: ${order.status}`);
            error.status = 400;
            throw error;
        }

        const normalizedItems = validation.data.items.map((item) => ({
            productId: item.productId || null,
            productName: item.productName,
            productDescription: item.productDescription || '',
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity,
        }));

        const previousTotal = order.totalAmount;
        const updatedOrder = await OrderRepository.updateItems(order._id.toString(), normalizedItems);

        setImmediate(() => {
            AdminLog.create({
                adminId,
                action: 'order_items_updated',
                actionDescription: `Items updated on order ${order.orderId} (${normalizedItems.length} item(s))`,
                targetResourceId: order._id,
                resourceType: 'Order',
                previousValue: { items: order.items, totalAmount: previousTotal },
                newValue: { items: normalizedItems, totalAmount: updatedOrder.totalAmount },
                ipAddress,
                userAgent,
            }).catch((err) => logger.error(`AdminLog error: ${err.message}`));

            ActivityLog.create({
                userId: order.userId,
                action: 'order_items_updated',
                actionDescription: `Order ${order.orderId} items updated by admin`,
                resourceId: order._id,
                resourceType: 'Order',
                status: 'success',
            }).catch((err) => logger.error(`ActivityLog error: ${err.message}`));
        });

        return updatedOrder;
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

        await OrderRepository.delete(orderId);

        await AdminLog.create({
            adminId,
            action: 'order_deleted',
            actionDescription: `Order ${order.orderId} deleted permanently`,
            targetResourceId: order._id,
            resourceType: 'Order',
            previousValue: { order: order.toObject() },
            ipAddress,
            userAgent,
        });

        return { success: true };
    }

    // Bulk update order status (admin only)
    async bulkUpdateOrderStatus(orderIds, status, adminId, adminRole = 'admin', ipAddress, userAgent) {
        const orders = await OrderRepository.findByQuery({ _id: { $in: orderIds } });

        const validTransitions = {
            pending: ['confirmed', 'cancelled'],
            confirmed: ['shipped', 'cancelled'],
            shipped: ['delivered', 'cancelled'],
            delivered: [],
            cancelled: [],
        };

        const eligibleOrders = orders.orders.filter((order) => {
            if (adminRole === 'super-admin') return true;
            const allowed = validTransitions[order.status] || [];
            return allowed.includes(status);
        });

        if (eligibleOrders.length === 0) {
            const error = new Error('No eligible orders found for this status transition.');
            error.status = 400;
            throw error;
        }

        const eligibleIds = eligibleOrders.map((o) => o._id);
        const updateData = { status };

        if (status === 'confirmed') {
            const estimatedDate = new Date();
            estimatedDate.setDate(estimatedDate.getDate() + 3);
            updateData.estimatedDeliveryDate = estimatedDate;
        }
        if (status === 'delivered') updateData.actualDeliveryDate = new Date();
        if (status === 'cancelled') updateData.paymentStatus = 'refunded';

        await OrderRepository.updateMany({ _id: { $in: eligibleIds } }, updateData);

        const updatedOrders = await OrderRepository.findByQuery({ _id: { $in: eligibleIds } });

        await AdminLog.create({
            adminId,
            action: 'order_bulk_status_updated',
            actionDescription: `Bulk status update to ${status} for ${eligibleIds.length} orders`,
            resourceType: 'Order',
            newValue: { status, orderIds: eligibleIds },
            ipAddress,
            userAgent,
        });

        const activityLogPromises = eligibleOrders.map((order) =>
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
            orders: updatedOrders.orders,
        };
    }

    // Advanced search
    async searchOrdersAdvanced(params, page = 1, limit = 10) {
        const { query, startDate, endDate, minAmount, maxAmount, status } = params;
        const mongooseQuery = {};

        if (query) {
            mongooseQuery.$or = [
                { orderId: { $regex: query, $options: 'i' } },
                { productName: { $regex: query, $options: 'i' } },
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
