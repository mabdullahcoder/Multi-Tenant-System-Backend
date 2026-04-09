/**
 * Order Repository
 * Database operations for Order model
 */

const Order = require('../models/Order');

class OrderRepository {
    // Create order
    async create(orderData) {
        return await Order.create(orderData);
    }

    // Find order by ID
    async findById(id) {
        return await Order.findById(id).populate('userId', 'firstName lastName email');
    }

    // Find order by Order ID
    async findByOrderId(orderId) {
        return await Order.findOne({ orderId }).populate('userId', 'firstName lastName email');
    }

    // Get user orders with pagination
    async getUserOrders(userId, page = 1, limit = 10, filters = {}) {
        const skip = (page - 1) * limit;
        const mongoose = require('mongoose');
        const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        const query = { userId: userObjectId, ...filters };

        const orders = await Order.find(query)
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Order.countDocuments(query);

        return {
            orders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Get all orders with pagination
    async getAllOrders(page = 1, limit = 10, filters = {}) {
        const skip = (page - 1) * limit;
        const query = { ...filters };

        const orders = await Order.find(query)
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 })
            .populate('userId', 'firstName lastName email phone');

        const total = await Order.countDocuments(query);

        return {
            orders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Update order
    async update(id, updateData) {
        return await Order.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });
    }

    // Update order status
    async updateStatus(id, status, updatedBy = null) {
        return await Order.findByIdAndUpdate(
            id,
            {
                status,
                ...(updatedBy && { updatedBy }),
            },
            {
                new: true,
                runValidators: true,
            }
        );
    }

    // Cancel order
    async cancelOrder(id, cancellationReason, cancelledBy = 'user') {
        return await Order.findByIdAndUpdate(
            id,
            {
                status: 'cancelled',
                cancellationReason,
                cancelledAt: new Date(),
                cancelledBy,
            },
            { new: true }
        );
    }

    // Search orders
    async searchOrders(query, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const searchQuery = {
            $or: [
                { orderId: { $regex: query, $options: 'i' } },
                { productName: { $regex: query, $options: 'i' } },
            ],
        };

        const orders = await Order.find(searchQuery)
            .populate('userId', 'firstName lastName email')
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Order.countDocuments(searchQuery);

        return {
            orders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Get order statistics
    async getOrderStats() {
        return await Order.aggregate([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    totalRevenue: [{ $group: { _id: null, total: { $sum: '$totalAmount' } } }],
                    byStatus: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                            },
                        },
                    ],
                    todayOrders: [
                        {
                            $match: {
                                createdAt: {
                                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                                },
                            },
                        },
                        { $count: 'count' },
                    ],
                },
            },
        ]);
    }

    // Get orders by date range
    async getOrdersByDateRange(startDate, endDate, filters = {}) {
        const query = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
            ...filters,
        };

        return await Order.find(query)
            .populate('userId', 'firstName lastName email')
            .sort({ createdAt: -1 });
    }

    /**
     * Append new items to an existing order and recalculate totalAmount.
     * Uses $push to add items atomically and $inc to update the total.
     */
    async appendItems(id, newItems) {
        const additionalTotal = newItems.reduce((sum, item) => sum + item.subtotal, 0);
        return await Order.findByIdAndUpdate(
            id,
            {
                $push: { items: { $each: newItems } },
                $inc: { totalAmount: additionalTotal },
            },
            { new: true, runValidators: true }
        ).populate('userId', 'firstName lastName email');
    }

    // Delete order
    async delete(id) {
        return await Order.findByIdAndDelete(id);
    }

    // Bulk update orders
    async updateMany(filter, updateData) {
        return await Order.updateMany(filter, updateData, { runValidators: true });
    }

    // Bulk delete orders
    async deleteMany(filter) {
        return await Order.deleteMany(filter);
    }

    // Find orders by custom query (Advanced Search)
    async findByQuery(query, page = 1, limit = 10, sort = { createdAt: -1 }) {
        const skip = (page - 1) * limit;
        const orders = await Order.find(query)
            .limit(limit)
            .skip(skip)
            .sort(sort)
            .populate('userId', 'firstName lastName email');

        const total = await Order.countDocuments(query);

        return {
            orders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
}

module.exports = new OrderRepository();
