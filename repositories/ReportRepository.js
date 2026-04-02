/**
 * Report Repository
 * Database operations for Report model
 */

const Report = require('../models/Report');

class ReportRepository {
    // Create report
    async create(reportData) {
        return await Report.create(reportData);
    }

    // Find report by ID
    async findById(id) {
        return await Report.findById(id).populate('userId generatedBy', 'firstName lastName email');
    }

    // Get user reports with pagination
    async getUserReports(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const reports = await Report.find({ userId })
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Report.countDocuments({ userId });

        return {
            reports,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Get all reports with pagination
    async getAllReports(page = 1, limit = 10, filters = {}) {
        const skip = (page - 1) * limit;
        const query = { ...filters };

        const reports = await Report.find(query)
            .populate('userId generatedBy', 'firstName lastName email')
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Report.countDocuments(query);

        return {
            reports,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Update report
    async update(id, updateData) {
        return await Report.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });
    }

    // Increment download count
    async incrementDownloadCount(id) {
        return await Report.findByIdAndUpdate(id, { $inc: { downloadCount: 1 } }, { new: true });
    }

    // Get reports by date range
    async getReportsByDateRange(startDate, endDate, filters = {}) {
        const query = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
            ...filters,
        };

        return await Report.find(query)
            .populate('userId generatedBy', 'firstName lastName email')
            .sort({ createdAt: -1 });
    }

    // Get report statistics
    async getReportStats() {
        return await Report.aggregate([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    byType: [
                        {
                            $group: {
                                _id: '$reportType',
                                count: { $sum: 1 },
                            },
                        },
                    ],
                    byStatus: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                            },
                        },
                    ],
                    totalDownloads: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$downloadCount' },
                            },
                        },
                    ],
                },
            },
        ]);
    }

    // Delete expired reports
    async deleteExpiredReports() {
        return await Report.deleteMany({
            expiresAt: { $lt: new Date() },
        });
    }

    // Delete report
    async delete(id) {
        return await Report.findByIdAndDelete(id);
    }
}

module.exports = new ReportRepository();
