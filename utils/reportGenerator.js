/**
 * Report Generator Utility
 * Generates PDF and CSV reports
 */

const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
// const fs = require('fs');
// const path = require('path');

class ReportGenerator {
    /**
     * Generate PDF report
     * @param {Object} reportData - Report data and metadata
     * @param {Array} data - Array of data records
     * @returns {Buffer} - PDF buffer
     */
    static async generatePDF(reportData, data) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];

                // Collect PDF data
                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Header
                doc.fontSize(20)
                    .font('Helvetica-Bold')
                    .text(reportData.title, { align: 'center' })
                    .moveDown();

                // Report Info
                doc.fontSize(10)
                    .font('Helvetica')
                    .text(`Report Type: ${reportData.reportType.replace(/_/g, ' ').toUpperCase()}`, { align: 'left' })
                    .text(`Generated: ${new Date(reportData.createdAt).toLocaleString()}`)
                    .text(`Format: ${reportData.format.toUpperCase()}`)
                    .moveDown();

                // Date Range if available
                if (reportData.dateRange?.startDate && reportData.dateRange?.endDate) {
                    doc.text(`Date Range: ${new Date(reportData.dateRange.startDate).toLocaleDateString()} - ${new Date(reportData.dateRange.endDate).toLocaleDateString()}`)
                        .moveDown();
                }

                // Metadata
                if (reportData.metadata) {
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .text('Summary', { underline: true })
                        .moveDown(0.5);

                    doc.fontSize(10)
                        .font('Helvetica');

                    if (reportData.metadata.totalRecords !== undefined) {
                        doc.text(`Total Records: ${reportData.metadata.totalRecords}`);
                    }
                    if (reportData.metadata.totalValue !== undefined) {
                        doc.text(`Total Value: ₹${reportData.metadata.totalValue.toFixed(2)}`);
                    }
                    if (reportData.metadata.totalRevenue !== undefined) {
                        doc.text(`Total Revenue: ₹${reportData.metadata.totalRevenue.toFixed(2)}`);
                    }
                    doc.moveDown();
                }

                // Data Table
                if (data && data.length > 0) {
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .text('Report Data', { underline: true })
                        .moveDown(0.5);

                    doc.fontSize(9)
                        .font('Helvetica');

                    // Determine report type and render accordingly
                    if (reportData.reportType === 'orders_report') {
                        this.renderOrdersTable(doc, data);
                    } else if (reportData.reportType === 'user_activity_report') {
                        this.renderActivityTable(doc, data);
                    } else if (reportData.reportType === 'sales_report') {
                        this.renderSalesTable(doc, data);
                    } else {
                        // Generic table rendering
                        this.renderGenericTable(doc, data);
                    }
                }

                // Footer
                const pageCount = doc.bufferedPageRange().count;
                for (let i = 0; i < pageCount; i++) {
                    doc.switchToPage(i);
                    doc.fontSize(8)
                        .text(
                            `Page ${i + 1} of ${pageCount}`,
                            50,
                            doc.page.height - 50,
                            { align: 'center' }
                        );
                }

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Render orders table in PDF — supports both multi-item and legacy single-item orders
     */
    static renderOrdersTable(doc, data) {
        const itemHeight = 18;
        const maxItemsPerPage = 28;
        let currentY = doc.y;
        let itemCount = 0;

        const renderHeaders = (y) => {
            doc.font('Helvetica-Bold').fontSize(9);
            doc.text('Order ID', 50, y, { width: 90 });
            doc.text('Date', 140, y, { width: 75 });
            doc.text('Product', 215, y, { width: 130 });
            doc.text('Qty', 345, y, { width: 30 });
            doc.text('Unit Price', 375, y, { width: 65 });
            doc.text('Subtotal', 440, y, { width: 65 });
            doc.text('Status', 505, y, { width: 55 });
            doc.moveTo(50, y + 14).lineTo(560, y + 14).stroke();
            doc.font('Helvetica').fontSize(9);
            return y + 18;
        };

        currentY = renderHeaders(currentY);

        data.forEach((order) => {
            const items = order.items && order.items.length > 0
                ? order.items
                : [{ productName: order.productName || 'N/A', quantity: order.quantity || 0, unitPrice: order.price || 0, subtotal: order.totalAmount || 0 }];

            const orderDate = order.orderDate || (order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A');

            items.forEach((item, idx) => {
                if (itemCount >= maxItemsPerPage) {
                    doc.addPage();
                    currentY = 50;
                    itemCount = 0;
                    currentY = renderHeaders(currentY);
                }

                // Only show orderId and date on the first item row of each order
                doc.text(idx === 0 ? (order.orderId || 'N/A') : '', 50, currentY, { width: 90 });
                doc.text(idx === 0 ? orderDate : '', 140, currentY, { width: 75 });
                doc.text(item.productName || 'N/A', 215, currentY, { width: 130 });
                doc.text(String(item.quantity || 0), 345, currentY, { width: 30 });
                doc.text(`₨${(item.unitPrice || 0).toFixed(2)}`, 375, currentY, { width: 65 });
                doc.text(`₨${(item.subtotal || 0).toFixed(2)}`, 440, currentY, { width: 65 });
                doc.text(idx === 0 ? (order.status || 'N/A') : '', 505, currentY, { width: 55 });

                currentY += itemHeight;
                itemCount++;
            });

            // Draw a light separator between orders
            if (items.length > 1) {
                doc.moveTo(50, currentY - 2).lineTo(560, currentY - 2).dash(2, { space: 2 }).stroke().undash();
            }

            // Show order total on its own row when multi-item
            if (items.length > 1) {
                if (itemCount >= maxItemsPerPage) {
                    doc.addPage();
                    currentY = 50;
                    itemCount = 0;
                    currentY = renderHeaders(currentY);
                }
                doc.font('Helvetica-Bold');
                doc.text('', 50, currentY, { width: 390 });
                doc.text('Order Total:', 390, currentY, { width: 55 });
                doc.text(`₨${(order.totalAmount || 0).toFixed(2)}`, 440, currentY, { width: 65 });
                doc.font('Helvetica');
                currentY += itemHeight;
                itemCount++;
            }
        });
    }

    /**
     * Render activity table in PDF
     */
    static renderActivityTable(doc, data) {
        const tableTop = doc.y;
        const itemHeight = 20;
        const maxItemsPerPage = 25;

        // Table headers
        doc.font('Helvetica-Bold');
        doc.text('Action', 50, tableTop, { width: 120 });
        doc.text('Description', 170, tableTop, { width: 200 });
        doc.text('Status', 370, tableTop, { width: 60 });
        doc.text('Timestamp', 430, tableTop, { width: 120 });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table rows
        doc.font('Helvetica');
        let currentY = tableTop + 20;
        let itemCount = 0;

        data.forEach((activity) => {
            if (itemCount >= maxItemsPerPage) {
                doc.addPage();
                currentY = 50;
                itemCount = 0;

                // Repeat headers
                doc.font('Helvetica-Bold');
                doc.text('Action', 50, currentY, { width: 120 });
                doc.text('Description', 170, currentY, { width: 200 });
                doc.text('Status', 370, currentY, { width: 60 });
                doc.text('Timestamp', 430, currentY, { width: 120 });
                doc.moveTo(50, currentY + 15).lineTo(550, currentY + 15).stroke();
                currentY += 20;
                doc.font('Helvetica');
            }

            doc.text(activity.action || 'N/A', 50, currentY, { width: 120 });
            doc.text(activity.actionDescription || 'N/A', 170, currentY, { width: 200 });
            doc.text(activity.status || 'N/A', 370, currentY, { width: 60 });
            doc.text(
                activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A',
                430,
                currentY,
                { width: 120 }
            );

            currentY += itemHeight;
            itemCount++;
        });
    }

    /**
     * Render sales table in PDF
     */
    static renderSalesTable(doc, data) {
        const tableTop = doc.y;
        const itemHeight = 20;
        const maxItemsPerPage = 25;

        // Table headers
        doc.font('Helvetica-Bold');
        doc.text('Order ID', 50, tableTop, { width: 80 });
        doc.text('Customer', 130, tableTop, { width: 100 });
        doc.text('Product', 230, tableTop, { width: 100 });
        doc.text('Qty', 330, tableTop, { width: 40 });
        doc.text('Amount', 370, tableTop, { width: 70 });
        doc.text('Date', 440, tableTop, { width: 100 });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table rows
        doc.font('Helvetica');
        let currentY = tableTop + 20;
        let itemCount = 0;

        data.forEach((sale) => {
            if (itemCount >= maxItemsPerPage) {
                doc.addPage();
                currentY = 50;
                itemCount = 0;

                // Repeat headers
                doc.font('Helvetica-Bold');
                doc.text('Order ID', 50, currentY, { width: 80 });
                doc.text('Customer', 130, currentY, { width: 100 });
                doc.text('Product', 230, currentY, { width: 100 });
                doc.text('Qty', 330, currentY, { width: 40 });
                doc.text('Amount', 370, currentY, { width: 70 });
                doc.text('Date', 440, currentY, { width: 100 });
                doc.moveTo(50, currentY + 15).lineTo(550, currentY + 15).stroke();
                currentY += 20;
                doc.font('Helvetica');
            }

            doc.text(sale.orderId || 'N/A', 50, currentY, { width: 80 });
            doc.text(sale.userName || 'N/A', 130, currentY, { width: 100 });
            doc.text(sale.productName || 'N/A', 230, currentY, { width: 100 });
            doc.text(String(sale.quantity || 0), 330, currentY, { width: 40 });
            doc.text(`₹${(sale.totalAmount || 0).toFixed(2)}`, 370, currentY, { width: 70 });
            doc.text(
                sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : 'N/A',
                440,
                currentY,
                { width: 100 }
            );

            currentY += itemHeight;
            itemCount++;
        });
    }

    /**
     * Render generic table in PDF
     */
    static renderGenericTable(doc, data) {
        data.forEach((item, index) => {
            doc.text(`Record ${index + 1}:`, { underline: true });
            Object.entries(item).forEach(([key, value]) => {
                doc.text(`  ${key}: ${value}`);
            });
            doc.moveDown();
        });
    }

    /**
     * Generate CSV report
     * @param {Array} data - Array of data records
     * @returns {string} - CSV string
     */
    static generateCSV(data) {
        try {
            if (!data || data.length === 0) {
                return '';
            }

            const parser = new Parser();
            return parser.parse(data);
        } catch (error) {
            console.error('Error generating CSV:', error);
            throw new Error('Failed to generate CSV report');
        }
    }
}

module.exports = ReportGenerator;
