/**
 * Report Service
 * Handles report generation and retrieval
 */

const Report = require('../models/Report');
const ReportRepository = require('../repositories/ReportRepository');
const OrderRepository = require('../repositories/OrderRepository');
const ActivityLogRepository = require('../repositories/ActivityLogRepository');
const ActivityLog = require('../models/ActivityLog');
const AdminLog = require('../models/AdminLog');
const { canAccessResource, requireAdmin } = require('../utils/authorizationHelper');
const ReportGenerator = require('../utils/reportGenerator');

class ReportService {
    // Generate report
    async generateReport(userId, userRole, reportType, format, dateRange, filters, ipAddress, userAgent) {
        try {
            // Validate report type and access
            const validReportTypes = ['orders_report', 'user_activity_report', 'sales_report'];
            if (!validReportTypes.includes(reportType)) {
                throw {
                    status: 400,
                    message: 'Invalid report type',
                };
            }

            // Sales and Activity reports require admin role
            if (reportType === 'sales_report') {
                requireAdmin(userRole);
            }

            // Create report record
            const report = await ReportRepository.create({
                userId,
                reportType,
                title: `${reportType.replace(/_/g, ' ')} - ${new Date().toLocaleDateString()}`,
                format,
                dateRange,
                filters,
                status: 'generating',
                generatedBy: userId,
            });

            // Generate report data based on type
            let reportData = [];
            let metadata = {};

            if (reportType === 'orders_report') {
                // Users get only their orders; admins get all
                const queryFilters = ['admin', 'super-admin'].includes(userRole)
                    ? filters
                    : { userId, ...filters };
                reportData = await this.generateOrdersReport(queryFilters, dateRange);
                metadata.totalRecords = reportData.length;
                metadata.totalValue = reportData.reduce((sum, order) => sum + order.totalAmount, 0);
            } else if (reportType === 'user_activity_report') {
                reportData = await this.generateActivityReport(userId, dateRange, filters);
                metadata.totalRecords = reportData.length;
            } else if (reportType === 'sales_report') {
                reportData = await this.generateSalesReport(dateRange, filters);
                metadata.totalRecords = reportData.length;
                metadata.totalRevenue = reportData.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            }

            // Store only metadata and report data (not file content)
            // Files will be generated on-demand during download
            report.metadata = {
                ...metadata,
                reportData: reportData.slice(0, 100),
            };

            report.fileSize = 0;
            report.status = 'completed';
            await report.save();

            // Log activity
            const logData = {
                userId,
                action: 'report_generated',
                actionDescription: `${reportType} generated in ${format} format`,
                resourceId: report._id,
                resourceType: 'Report',
                ipAddress,
                userAgent,
                status: 'success',
            };

            await ActivityLog.create(logData);

            // Log admin activity if admin
            if (['admin', 'super-admin'].includes(userRole)) {
                await AdminLog.create({
                    adminId: userId,
                    action: 'report_generated',
                    actionDescription: `Report generated: ${reportType}`,
                    targetResourceId: report._id,
                    resourceType: 'Report',
                    ipAddress,
                    userAgent,
                });
            }

            return report;
        } catch (error) {
            throw {
                status: error.status || 500,
                message: error.message || 'Error generating report',
            };
        }
    }

    // Generate orders report
    async generateOrdersReport(filters = {}, dateRange) {
        try {
            let orders;

            // If date range is provided, use it; otherwise get all orders
            if (dateRange?.startDate && dateRange?.endDate) {
                orders = await OrderRepository.getOrdersByDateRange(
                    dateRange.startDate,
                    dateRange.endDate,
                    filters
                );
            } else {
                // Get all orders without date filtering
                const result = await OrderRepository.getAllOrders(1, 1000, filters);
                orders = result.orders;
            }

            return orders.map((order) => {
                // Build item-level rows for multi-item orders
                if (order.items && order.items.length > 0) {
                    return {
                        orderId: order.orderId,
                        orderDate: order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'short', day: 'numeric',
                            })
                            : 'N/A',
                        items: order.items.map((item) => ({
                            productName: item.productName,
                            quantity: item.quantity,
                            unitPrice: item.price,
                            subtotal: item.subtotal,
                        })),
                        totalAmount: order.totalAmount,
                        status: order.status,
                        paymentStatus: order.paymentStatus,
                        createdAt: order.createdAt,
                    };
                }
                // Legacy single-item order
                return {
                    orderId: order.orderId,
                    orderDate: order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                        })
                        : 'N/A',
                    items: [{
                        productName: order.productName || 'N/A',
                        quantity: order.quantity || 0,
                        unitPrice: order.price || 0,
                        subtotal: order.totalAmount || 0,
                    }],
                    totalAmount: order.totalAmount,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    createdAt: order.createdAt,
                };
            });
        } catch (error) {
            throw new Error(`Error generating orders report: ${error.message}`);
        }
    }

    // Generate activity report
    async generateActivityReport(userId, dateRange, filters = {}) {
        try {
            let logs;

            // If date range is provided, use it; otherwise get recent logs
            if (dateRange?.startDate && dateRange?.endDate) {
                logs = await ActivityLogRepository.getLogsByDateRange(
                    dateRange.startDate,
                    dateRange.endDate,
                    { userId, ...filters }
                );
            } else {
                // Get recent activity logs (last 30 days by default)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                logs = await ActivityLogRepository.getLogsByDateRange(
                    thirtyDaysAgo,
                    new Date(),
                    { userId, ...filters }
                );
            }

            return logs.map((log) => ({
                action: log.action,
                actionDescription: log.actionDescription,
                timestamp: log.createdAt,
                ipAddress: log.ipAddress,
                status: log.status,
            }));
        } catch (error) {
            throw new Error(`Error generating activity report: ${error.message}`);
        }
    }

    // Generate sales report (admin only)
    async generateSalesReport(dateRange, filters = {}) {
        try {
            let orders;

            // If date range is provided, use it; otherwise get all delivered orders
            if (dateRange?.startDate && dateRange?.endDate) {
                orders = await OrderRepository.getOrdersByDateRange(
                    dateRange.startDate,
                    dateRange.endDate,
                    { status: 'delivered', ...filters }
                );
            } else {
                // Get all delivered orders
                const result = await OrderRepository.getAllOrders(1, 1000, { status: 'delivered', ...filters });
                orders = result.orders;
            }

            return orders.map((order) => ({
                orderId: order.orderId,
                userId: order.userId._id,
                userName: `${order.userId.firstName} ${order.userId.lastName}`,
                productName: order.productName,
                quantity: order.quantity,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt,
                deliveredAt: order.actualDeliveryDate,
            }));
        } catch (error) {
            throw new Error(`Error generating sales report: ${error.message}`);
        }
    }

    // Get user reports
    async getUserReports(userId, page = 1, limit = 10) {
        return await ReportRepository.getUserReports(userId, page, limit);
    }

    // Get all reports (admin only)
    async getAllReports(page = 1, limit = 10, filters = {}) {
        return await ReportRepository.getAllReports(page, limit, filters);
    }

    // Get report by ID
    async getReportById(reportId, userId, userRole = 'user') {
        const report = await ReportRepository.findById(reportId);
        if (!report) {
            throw {
                status: 404,
                message: 'Report not found',
            };
        }

        // Extract the actual userId from the populated object
        const reportOwnerId = report.userId._id || report.userId;

        // Check authorization: User can only see their own reports, admins can see all
        if (!canAccessResource(userRole, reportOwnerId, userId)) {
            throw {
                status: 403,
                message: 'You are not authorized to access this report.',
            };
        }

        return report;
    }

    // Download report
    async downloadReport(reportId, userId, userRole, ipAddress, userAgent) {
        const report = await ReportRepository.findById(reportId);
        if (!report) {
            throw {
                status: 404,
                message: 'Report not found',
            };
        }

        // Extract the actual userId from the populated object
        const reportOwnerId = report.userId._id || report.userId;

        // Check authorization
        if (!canAccessResource(userRole, reportOwnerId, userId)) {
            throw {
                status: 403,
                message: 'You are not authorized to download this report.',
            };
        }

        // Always regenerate report data for download (don't store in DB)
        let reportData = [];

        if (report.reportType === 'orders_report') {
            const queryFilters = ['admin', 'super-admin'].includes(userRole)
                ? report.filters || {}
                : { userId: reportOwnerId, ...(report.filters || {}) };
            reportData = await this.generateOrdersReport(queryFilters, report.dateRange);
        } else if (report.reportType === 'user_activity_report') {
            reportData = await this.generateActivityReport(reportOwnerId, report.dateRange, report.filters || {});
        } else if (report.reportType === 'sales_report') {
            reportData = await this.generateSalesReport(report.dateRange, report.filters || {});
        }

        // Generate file content on-the-fly (don't save to DB)
        if (report.format === 'pdf') {
            const reportInfo = {
                title: report.title,
                reportType: report.reportType,
                format: report.format,
                createdAt: report.createdAt,
                dateRange: report.dateRange,
                metadata: report.metadata || {},
            };
            const fileContent = await ReportGenerator.generatePDF(reportInfo, reportData);
            report.fileBuffer = fileContent; // Attach buffer temporarily for controller
        } else if (report.format === 'csv') {
            // Flatten multi-item orders for CSV so each item gets its own row
            let csvData = reportData;
            if (report.reportType === 'orders_report') {
                csvData = reportData.flatMap((order) =>
                    (order.items || []).map((item) => ({
                        orderId: order.orderId,
                        orderDate: order.orderDate || '',
                        productName: item.productName,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.subtotal,
                        orderTotal: order.totalAmount,
                        status: order.status,
                        paymentStatus: order.paymentStatus,
                    }))
                );
            }
            const fileContent = ReportGenerator.generateCSV(csvData);
            report.fileContent = fileContent; // Attach content temporarily for controller
        }

        // Increment download count
        await ReportRepository.incrementDownloadCount(reportId);

        // Log activity
        await ActivityLog.create({
            userId: reportOwnerId,
            action: 'report_downloaded',
            actionDescription: `${report.reportType} downloaded`,
            resourceId: reportId,
            resourceType: 'Report',
            ipAddress,
            userAgent,
            status: 'success',
        });

        return report;
    }

    // Delete report
    async deleteReport(reportId, userId, userRole) {
        // Only admins can delete reports
        requireAdmin(userRole);

        const report = await ReportRepository.findById(reportId);
        if (!report) {
            throw {
                status: 404,
                message: 'Report not found',
            };
        }

        // Log admin activity
        await AdminLog.create({
            adminId: userId,
            action: 'report_deleted',
            actionDescription: `Report deleted: ${report.reportType}`,
            targetResourceId: reportId,
            resourceType: 'Report',
        });

        return await ReportRepository.delete(reportId);
    }

    // Get report statistics (admin only)
    async getReportStats() {
        return await ReportRepository.getReportStats();
    }

    // Get Sales Summary (Admin Only)
    async getSalesSummary(startDate, endDate) {
        const filters = { status: 'delivered' };
        const orders = await OrderRepository.getOrdersByDateRange(startDate, endDate, filters);

        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Group by date for a simple trend
        const dailyTrends = orders.reduce((acc, o) => {
            const date = new Date(o.createdAt).toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + o.totalAmount;
            return acc;
        }, {});

        return {
            totalRevenue,
            totalOrders,
            avgOrderValue,
            currency: '₨',
            dailyTrends
        };
    }

    // Get Top Products (Admin Only)
    async getTopProducts(limit = 5) {
        const orders = await OrderRepository.getAllOrders(1, 1000, { status: 'delivered' });
        const productMap = orders.orders.reduce((acc, o) => {
            acc[o.productName] = (acc[o.productName] || 0) + o.totalAmount;
            return acc;
        }, {});

        return Object.entries(productMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit);
    }

    // ─── COMPREHENSIVE ANALYTICS ─────────────────────────────────────────────

    /**
     * KPI Overview: total sales, orders, avg order value, revenue trend
     * period: 'daily' | 'weekly' | 'monthly'
     */
    async getKPIOverview(period = 'monthly') {
        const Order = require('../models/Order');
        const now = new Date();

        // Build current & previous period date ranges
        let currentStart, previousStart, previousEnd;
        if (period === 'daily') {
            currentStart = new Date(now); currentStart.setHours(0, 0, 0, 0);
            previousStart = new Date(currentStart); previousStart.setDate(previousStart.getDate() - 1);
            previousEnd = new Date(currentStart);
        } else if (period === 'weekly') {
            currentStart = new Date(now); currentStart.setDate(now.getDate() - 6); currentStart.setHours(0, 0, 0, 0);
            previousStart = new Date(currentStart); previousStart.setDate(previousStart.getDate() - 7);
            previousEnd = new Date(currentStart);
        } else {
            currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
            previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            previousEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const [currentAgg, previousAgg, trendAgg] = await Promise.all([
            Order.aggregate([
                { $match: { createdAt: { $gte: currentStart }, status: { $ne: 'cancelled' } } },
                { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } },
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: previousStart, $lt: previousEnd }, status: { $ne: 'cancelled' } } },
                { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } },
            ]),
            // Revenue trend: group by day for the current period
            Order.aggregate([
                { $match: { createdAt: { $gte: currentStart }, status: { $ne: 'cancelled' } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        revenue: { $sum: '$totalAmount' },
                        orders: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        const cur = currentAgg[0] || { totalRevenue: 0, totalOrders: 0 };
        const prev = previousAgg[0] || { totalRevenue: 0, totalOrders: 0 };

        const pctChange = (cur, prev) => prev === 0 ? 0 : (((cur - prev) / prev) * 100).toFixed(1);

        return {
            totalRevenue: cur.totalRevenue,
            totalOrders: cur.totalOrders,
            avgOrderValue: cur.totalOrders > 0 ? (cur.totalRevenue / cur.totalOrders).toFixed(2) : 0,
            revenueChange: pctChange(cur.totalRevenue, prev.totalRevenue),
            ordersChange: pctChange(cur.totalOrders, prev.totalOrders),
            trend: trendAgg.map(d => ({ date: d._id, revenue: d.revenue, orders: d.orders })),
        };
    }

    /**
     * Orders report with advanced filtering
     */
    async getOrdersAnalytics(filters = {}) {
        const Order = require('../models/Order');
        const { startDate, endDate, status, paymentMethod, page = 1, limit = 20 } = filters;

        const match = {};
        if (startDate && endDate) match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        if (status) match.status = status;
        if (paymentMethod) match.paymentMethod = paymentMethod;

        const skip = (page - 1) * limit;

        const [orders, total, statusBreakdown, paymentBreakdown] = await Promise.all([
            Order.find(match)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('userId', 'firstName lastName email'),
            Order.countDocuments(match),
            Order.aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
            ]),
            Order.aggregate([
                { $match: match },
                { $group: { _id: '$paymentMethod', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
            ]),
        ]);

        return {
            orders,
            pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
            statusBreakdown,
            paymentBreakdown,
        };
    }

    /**
     * Menu performance analytics
     */
    async getMenuAnalytics(filters = {}) {
        const Order = require('../models/Order');
        const { startDate, endDate } = filters;

        const match = { status: { $ne: 'cancelled' } };
        if (startDate && endDate) match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const [itemPerformance, categoryPerformance] = await Promise.all([
            // Item-level: unwind items array
            Order.aggregate([
                { $match: match },
                { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
                {
                    $group: {
                        _id: '$items.productName',
                        productId: { $first: '$items.productId' },
                        totalQuantity: { $sum: '$items.quantity' },
                        totalRevenue: { $sum: '$items.subtotal' },
                        orderCount: { $sum: 1 },
                        avgPrice: { $avg: '$items.price' },
                    },
                },
                { $sort: { totalRevenue: -1 } },
            ]),
            // Category-level via lookup
            Order.aggregate([
                { $match: match },
                { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
                {
                    $lookup: {
                        from: 'menuitems',
                        localField: 'items.productId',
                        foreignField: '_id',
                        as: 'menuItem',
                    },
                },
                { $unwind: { path: '$menuItem', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'menucategories',
                        localField: 'menuItem.category',
                        foreignField: '_id',
                        as: 'category',
                    },
                },
                { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: { $ifNull: ['$category.name', 'Uncategorized'] },
                        totalRevenue: { $sum: '$items.subtotal' },
                        totalQuantity: { $sum: '$items.quantity' },
                        orderCount: { $sum: 1 },
                    },
                },
                { $sort: { totalRevenue: -1 } },
            ]),
        ]);

        const topItems = itemPerformance.slice(0, 10);
        const leastItems = [...itemPerformance].reverse().slice(0, 5);

        return { topItems, leastItems, allItems: itemPerformance, categoryPerformance };
    }

    /**
     * Payment analytics breakdown
     */
    async getPaymentAnalytics(filters = {}) {
        const Order = require('../models/Order');
        const { startDate, endDate } = filters;

        const match = {};
        if (startDate && endDate) match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const [byMethod, byStatus, dailyTrend] = await Promise.all([
            Order.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: '$paymentMethod',
                        count: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' },
                    },
                },
                { $sort: { revenue: -1 } },
            ]),
            Order.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: '$paymentStatus',
                        count: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' },
                    },
                },
            ]),
            Order.aggregate([
                { $match: { ...match, paymentStatus: 'completed' } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        revenue: { $sum: '$totalAmount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                { $limit: 30 },
            ]),
        ]);

        return { byMethod, byStatus, dailyTrend };
    }

    /**
     * Kitchen performance metrics
     */
    async getKitchenAnalytics(filters = {}) {
        const Order = require('../models/Order');
        const { startDate, endDate } = filters;

        const match = {};
        if (startDate && endDate) match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const [statusCounts, hourlyDistribution, completionTimes] = await Promise.all([
            Order.aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            // Orders by hour of day
            Order.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { $hour: '$createdAt' },
                        count: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            // Avg time from pending → delivered (using updatedAt as proxy)
            Order.aggregate([
                { $match: { ...match, status: 'delivered', actualDeliveryDate: { $exists: true, $ne: null } } },
                {
                    $project: {
                        prepTime: {
                            $divide: [
                                { $subtract: ['$actualDeliveryDate', '$createdAt'] },
                                60000, // ms → minutes
                            ],
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        avgPrepTime: { $avg: '$prepTime' },
                        minPrepTime: { $min: '$prepTime' },
                        maxPrepTime: { $max: '$prepTime' },
                    },
                },
            ]),
        ]);

        const statusMap = statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
        const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
        const delivered = statusMap.delivered || 0;
        const cancelled = statusMap.cancelled || 0;
        const pending = statusMap.pending || 0;
        const confirmed = statusMap.confirmed || 0;

        return {
            statusCounts: statusMap,
            total,
            completionRate: total > 0 ? ((delivered / total) * 100).toFixed(1) : 0,
            cancellationRate: total > 0 ? ((cancelled / total) * 100).toFixed(1) : 0,
            activeOrders: pending + confirmed,
            hourlyDistribution: hourlyDistribution.map(h => ({
                hour: `${String(h._id).padStart(2, '0')}:00`,
                orders: h.count,
                revenue: h.revenue,
            })),
            avgPrepTime: completionTimes[0]?.avgPrepTime?.toFixed(1) || null,
        };
    }

    /**
     * Export analytics data as PDF or CSV
     */
    async exportAnalytics(type, format, filters = {}) {
        const ReportGenerator = require('../utils/reportGenerator');
        let data = [];
        let title = '';

        if (type === 'orders') {
            const result = await this.getOrdersAnalytics({ ...filters, limit: 10000 });
            data = result.orders.map(o => ({
                orderId: o.orderId,
                customer: o.userId ? `${o.userId.firstName} ${o.userId.lastName}` : 'N/A',
                totalAmount: o.totalAmount,
                status: o.status,
                paymentMethod: o.paymentMethod,
                paymentStatus: o.paymentStatus,
                createdAt: new Date(o.createdAt).toLocaleString(),
            }));
            title = 'Orders Analytics Report';
        } else if (type === 'menu') {
            const result = await this.getMenuAnalytics(filters);
            data = result.allItems.map(i => ({
                itemName: i._id,
                totalQuantitySold: i.totalQuantity,
                totalRevenue: i.totalRevenue,
                orderCount: i.orderCount,
                avgPrice: i.avgPrice?.toFixed(2),
            }));
            title = 'Menu Performance Report';
        } else if (type === 'payments') {
            const result = await this.getPaymentAnalytics(filters);
            data = result.byMethod.map(p => ({
                paymentMethod: p._id,
                transactionCount: p.count,
                totalRevenue: p.revenue,
            }));
            title = 'Payment Analytics Report';
        } else if (type === 'kitchen') {
            const result = await this.getKitchenAnalytics(filters);
            data = result.hourlyDistribution;
            title = 'Kitchen Performance Report';
        }

        const reportMeta = {
            title,
            reportType: `${type}_analytics`,
            format,
            createdAt: new Date(),
            dateRange: filters,
            metadata: { totalRecords: data.length },
        };

        if (format === 'pdf') {
            return { buffer: await ReportGenerator.generatePDF(reportMeta, data), format: 'pdf', title };
        } else {
            return { content: ReportGenerator.generateCSV(data), format: 'csv', title };
        }
    }
}

module.exports = new ReportService();
