/**
 * Report Controller
 * Handles report endpoints
 */

const ReportService = require('../services/ReportService');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const { getClientIp, getUserAgent } = require('../middlewares/loggerMiddleware');

class ReportController {
    // Generate report
    async generateReport(req, res, next) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            const { reportType, format, dateRange, filters } = req.body;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            if (!reportType || !format) {
                return sendError(res, 400, 'reportType and format are required');
            }

            const report = await ReportService.generateReport(
                userId,
                userRole,
                reportType,
                format,
                dateRange,
                filters,
                ipAddress,
                userAgent
            );

            sendSuccess(res, 201, 'Report generated successfully', report);
        } catch (error) {
            next(error);
        }
    }

    // Get user reports
    async getUserReports(req, res, next) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;

            const result = await ReportService.getUserReports(userId, parseInt(page), parseInt(limit));

            sendSuccess(res, 200, 'Reports retrieved successfully', result.reports, result.pagination);
        } catch (error) {
            next(error);
        }
    }

    // Get all reports (admin only)
    async getAllReports(req, res, next) {
        try {
            const { page = 1, limit = 10, reportType = null, status = null } = req.query;
            const filters = {};

            if (reportType) filters.reportType = reportType;
            if (status) filters.status = status;

            const result = await ReportService.getAllReports(parseInt(page), parseInt(limit), filters);

            sendSuccess(res, 200, 'Reports retrieved successfully', result.reports, result.pagination);
        } catch (error) {
            next(error);
        }
    }

    // Get report by ID
    async getReportById(req, res, next) {
        try {
            const { reportId } = req.params;
            const userId = req.user.id;
            const userRole = req.user.role;

            const report = await ReportService.getReportById(reportId, userId, userRole);

            sendSuccess(res, 200, 'Report retrieved successfully', report);
        } catch (error) {
            next(error);
        }
    }

    // Download report
    async downloadReport(req, res, next) {
        try {
            const { reportId } = req.params;
            const userId = req.user.id;
            const userRole = req.user.role;
            const ipAddress = getClientIp(req);
            const userAgent = getUserAgent(req);

            const report = await ReportService.downloadReport(reportId, userId, userRole, ipAddress, userAgent);

            // Set appropriate headers based on format
            const filename = `${report.title.replace(/\s+/g, '_')}_${report._id}.${report.format}`;

            if (report.format === 'pdf') {
                const pdfBuffer = report.fileBuffer;

                if (!pdfBuffer) {
                    return sendError(res, 500, 'Failed to generate PDF');
                }

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', pdfBuffer.length);

                return res.send(pdfBuffer);
            } else if (report.format === 'csv') {
                const csvContent = report.fileContent;

                if (!csvContent) {
                    return sendError(res, 500, 'Failed to generate CSV');
                }

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

                return res.send(csvContent);
            } else {
                return sendError(res, 400, 'Unsupported report format');
            }
        } catch (error) {
            next(error);
        }
    }

    // Delete report (admin only)
    async deleteReport(req, res, next) {
        try {
            const { reportId } = req.params;
            const userId = req.user.id;
            const userRole = req.user.role;

            await ReportService.deleteReport(reportId, userId, userRole);

            sendSuccess(res, 200, 'Report deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    // Get report statistics (admin only)
    async getReportStats(req, res, next) {
        try {
            const stats = await ReportService.getReportStats();
            sendSuccess(res, 200, 'Report statistics retrieved', stats);
        } catch (error) {
            next(error);
        }
    }

    // Get Sales Summary (Admin Only)
    async getSalesSummary(req, res, next) {
        try {
            const { startDate, endDate } = req.query;
            const summary = await ReportService.getSalesSummary(startDate, endDate);
            sendSuccess(res, 200, 'Sales summary retrieved', summary);
        } catch (error) {
            next(error);
        }
    }

    // Get Top Products (Admin Only)
    async getTopProducts(req, res, next) {
        try {
            const { limit = 5 } = req.query;
            const products = await ReportService.getTopProducts(parseInt(limit));
            sendSuccess(res, 200, 'Top products retrieved', products);
        } catch (error) {
            next(error);
        }
    }

    // ─── COMPREHENSIVE ANALYTICS ENDPOINTS ───────────────────────────────────

    // KPI Overview
    async getKPIOverview(req, res, next) {
        try {
            const { period = 'monthly' } = req.query;
            const data = await ReportService.getKPIOverview(period);
            sendSuccess(res, 200, 'KPI overview retrieved', data);
        } catch (error) {
            next(error);
        }
    }

    // Orders Analytics
    async getOrdersAnalytics(req, res, next) {
        try {
            const { startDate, endDate, status, paymentMethod, page = 1, limit = 20 } = req.query;
            const data = await ReportService.getOrdersAnalytics({ startDate, endDate, status, paymentMethod, page, limit });
            sendSuccess(res, 200, 'Orders analytics retrieved', data);
        } catch (error) {
            next(error);
        }
    }

    // Menu Analytics
    async getMenuAnalytics(req, res, next) {
        try {
            const { startDate, endDate } = req.query;
            const data = await ReportService.getMenuAnalytics({ startDate, endDate });
            sendSuccess(res, 200, 'Menu analytics retrieved', data);
        } catch (error) {
            next(error);
        }
    }

    // Payment Analytics
    async getPaymentAnalytics(req, res, next) {
        try {
            const { startDate, endDate } = req.query;
            const data = await ReportService.getPaymentAnalytics({ startDate, endDate });
            sendSuccess(res, 200, 'Payment analytics retrieved', data);
        } catch (error) {
            next(error);
        }
    }

    // Kitchen Analytics
    async getKitchenAnalytics(req, res, next) {
        try {
            const { startDate, endDate } = req.query;
            const data = await ReportService.getKitchenAnalytics({ startDate, endDate });
            sendSuccess(res, 200, 'Kitchen analytics retrieved', data);
        } catch (error) {
            next(error);
        }
    }

    // Export Analytics
    async exportAnalytics(req, res, next) {
        try {
            const { type, format = 'csv', startDate, endDate } = req.query;
            if (!type) return sendError(res, 400, 'Export type is required');
            const validTypes = ['orders', 'menu', 'payments', 'kitchen'];
            if (!validTypes.includes(type)) return sendError(res, 400, 'Invalid export type');

            const result = await ReportService.exportAnalytics(type, format, { startDate, endDate });
            const filename = `${result.title.replace(/\s+/g, '_')}_${Date.now()}.${result.format}`;

            if (result.format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                return res.send(result.buffer);
            } else {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                return res.send(result.content);
            }
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ReportController();
