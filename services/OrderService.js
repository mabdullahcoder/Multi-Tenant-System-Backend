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
    // Create order - supports both single-item and multi-item orders
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

            // Prepare order data for both single and multi-item orders
            const preparedData = {
                userId,
                deliveryAddress: validation.data.deliveryAddress,
                notes: validation.data.notes || null,
                status: 'pending',
                paymentStatus: 'pending',
                paymentMethod: validation.data.paymentMethod || 'credit_card',
            };

            // Check if this is a multi-item order or single-item order
            if (validation.data.items && Array.isArray(validation.data.items) && validation.data.items.length > 0) {
                // Multi-item order
                console.log(`Creating multi-item order with ${validation.data.items.length} items`);
                preparedData.items = validation.data.items;
                // Calculate totalAmount here so Mongoose required validation passes
                preparedData.totalAmount = validation.data.items.reduce(
                    (sum, item) => sum + (item.subtotal ?? item.price * item.quantity),
                    0
                );
            } else {
                // Single-item order (backward compatibility)
                console.log('Creating single-item order');
                preparedData.productName = validation.data.productName;
                preparedData.productDescription = validation.data.productDescription || '';
                preparedData.quantity = validation.data.quantity;
                preparedData.price = validation.data.price;
                preparedData.totalAmount = validation.data.totalAmount;
            }

            // Create order
            const order = await OrderRepository.create(preparedData);

            console.log('OrderService.createOrder - Order created successfully:', order.orderId);
            console.log('Order items count:', order.items?.length || 1);

            // Log activity (non-blocking)
            setImmediate(() => {
                const itemsDesc = order.items?.length > 1
                    ? `${order.items.length} items`
                    : `${order.productName}`;

                ActivityLog.create({
                    userId,
                    action: 'order_created',
                    actionDescription: `Order created: ${order.orderId} (${itemsDesc})`,
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
        console.log('\n========== ORDER STATUS UPDATE REQUEST ==========');
        console.log(`Order ID: ${orderId}`);
        console.log(`Requested Status: ${status}`);
        console.log(`Admin Role: ${adminRole}`);

        // Support both MongoDB _id and human-readable orderId (ORD-xxx)
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
        const previousOrder = isObjectId
            ? await OrderRepository.findById(orderId)
            : await OrderRepository.findByOrderId(orderId);

        if (!previousOrder) {
            const error = new Error('Order not found');
            error.status = 404;
            console.error(`❌ Order not found: ${orderId}`);
            throw error;
        }

        // Always use the MongoDB _id for subsequent DB operations
        const dbId = previousOrder._id.toString();

        console.log(`Current Status: ${previousOrder.status}`);
        console.log(`Order ID (DB): ${previousOrder.orderId}`);

        // Validate status transitions
        // Senior Developer Note: Standard flow is maintained for safety, 
        // but Super-Admins can bypass this for manual corrections.
        const validTransitions = {
            pending: ['confirmed', 'cancelled'],
            confirmed: ['shipped', 'delivered', 'cancelled'],
            shipped: ['delivered', 'cancelled'],
            delivered: [],
            cancelled: []
        };

        const isSuperAdmin = adminRole === 'super-admin';
        const allowedStatuses = validTransitions[previousOrder.status] || [];

        console.log(`Valid Transitions: ${allowedStatuses.join(', ') || 'none'}`);
        console.log(`Is Super Admin: ${isSuperAdmin}`);

        if (!isSuperAdmin && !allowedStatuses.includes(status)) {
            const error = new Error(
                `Invalid status transition from ${previousOrder.status} to ${status}. ` +
                `Allowed transitions: ${allowedStatuses.join(', ') || 'none'}`
            );
            error.status = 400;
            console.error(`❌ Invalid Transition: ${error.message}`);
            throw error;
        }

        console.log(`✓ Transition Valid`);

        // Prepare update data
        const updateData = { status };

        // Auto-set estimated delivery date when order is confirmed (3 days from now)
        if (status === 'confirmed' && !previousOrder.estimatedDeliveryDate) {
            const estimatedDate = new Date();
            estimatedDate.setDate(estimatedDate.getDate() + 3);
            updateData.estimatedDeliveryDate = estimatedDate;
        }

        // Record the exact moment the order was confirmed — used by KDS timer to survive page refreshes
        if (status === 'confirmed' && !previousOrder.confirmedAt) {
            updateData.confirmedAt = new Date();
        }

        // Auto-set actual delivery date when order is delivered
        if (status === 'delivered' && !previousOrder.actualDeliveryDate) {
            updateData.actualDeliveryDate = new Date();
        }

        // Update payment status to refunded when order is cancelled
        if (status === 'cancelled' && previousOrder.paymentStatus === 'completed') {
            updateData.paymentStatus = 'refunded';
        }

        console.log(`Update Data:`, JSON.stringify(updateData, null, 2));

        // Use the resolved MongoDB _id, not the raw orderId param (which may be ORD-xxx string)
        const order = await OrderRepository.update(dbId, updateData);

        console.log(`✓ Order Updated in DB`);
        console.log(`Updated Order Status: ${order.status}`);
        console.log(`Updated Order ID: ${order.orderId}`);

        // SENIOR DEBUG: Verify status was actually updated
        if (order.status !== status) {
            console.warn(`⚠️ WARNING: Status mismatch! Requested: ${status}, Got: ${order.status}`);
        } else {
            console.log(`✓ Status Update Verified`);
        }

        // Log admin activity
        await AdminLog.create({
            adminId,
            action: 'order_status_updated',
            actionDescription: `Order ${orderId} status changed from ${previousOrder.status} to ${status}`,
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

        console.log(`========== STATUS UPDATE COMPLETE ==========\n`);
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
                targetResourceId: order._id,
                resourceType: 'Order',
                ipAddress,
                userAgent,
            });
        }

        return cancelledOrder;
    }

    /**
     * Append items to a confirmed order (admin only).
     * Computes the diff between the incoming full item list and the existing items,
     * then pushes only the net-new / increased-quantity items to the DB.
     *
     * Diff logic:
     *  - For each incoming item, find a matching existing item by productName (case-insensitive).
     *  - If the incoming quantity > existing quantity → push the delta as a new sub-document.
     *  - If the item doesn't exist yet → push it as-is.
     *  - Items whose quantity decreased or stayed the same are ignored (no removal).
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

        // Only allow appending to confirmed orders
        if (!['confirmed', 'pending'].includes(order.status)) {
            const error = new Error(`Cannot add items to an order with status: ${order.status}`);
            error.status = 400;
            throw error;
        }

        const existingItems = Array.isArray(order.items) ? order.items : [];

        // Build a map of existing items keyed by productName (lowercase)
        const existingMap = existingItems.reduce((map, item) => {
            const key = item.productName.toLowerCase().trim();
            map[key] = (map[key] || 0) + item.quantity;
            return map;
        }, {});

        // Compute delta items
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

        // Log admin activity (non-blocking)
        setImmediate(() => {
            const AdminLog = require('../models/AdminLog');
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
            }).catch(err => console.error('AdminLog error:', err));

            const ActivityLog = require('../models/ActivityLog');
            ActivityLog.create({
                userId: order.userId,
                action: 'order_items_added',
                actionDescription: `${deltaItems.length} item(s) added to order ${order.orderId} by admin`,
                resourceId: order._id,
                resourceType: 'Order',
                status: 'success',
            }).catch(err => console.error('ActivityLog error:', err));
        });

        return { updatedOrder, deltaItems };
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
