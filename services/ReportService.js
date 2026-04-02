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
            console.log('ReportService.generateReport - Starting report generation');
            console.log('Report Type:', reportType);
            console.log('Format:', format);
            console.log('Date Range:', dateRange);
            console.log('Filters:', filters);

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

            console.log('Report record created:', report._id);

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

            console.log('Report data generated, records:', metadata.totalRecords);

            // Store only metadata and report data (not file content)
            // Files will be generated on-demand during download
            report.metadata = {
                ...metadata,
                reportData: reportData.slice(0, 100), // Store only first 100 records as sample
            };

            // Update report with metadata and status
            report.fileSize = 0; // Will be calculated on download
            report.status = 'completed';
            await report.save();

            console.log('Report completed successfully');

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
            console.error('ReportService.generateReport - Error:', error);
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

            return orders.map((order) => ({
                orderId: order.orderId,
                productName: order.productName,
                quantity: order.quantity,
                price: order.price,
                totalAmount: order.totalAmount,
                status: order.status,
                paymentStatus: order.paymentStatus,
                createdAt: order.createdAt,
            }));
        } catch (error) {
            console.error('Error generating orders report:', error);
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
            console.error('Error generating activity report:', error);
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
            console.error('Error generating sales report:', error);
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

        console.log('Generating file for download, report type:', report.reportType);

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

        console.log('Report data regenerated, records:', reportData.length);

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
            const fileContent = ReportGenerator.generateCSV(reportData);
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
}

module.exports = new ReportService();
