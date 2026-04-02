/**
 * Main Application File
 * Entry point for the Express server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const { logActivity } = require('./middlewares/loggerMiddleware');
const logger = require('./utils/logger');

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reportRoutes = require('./routes/reportRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const menuRoutes = require('./routes/menuRoutes');

const http = require('http');
const socketIO = require('./utils/socket');

// Initialize app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
socketIO.init(server);

// Connect to database
connectDB();

// MIDDLEWARE
// Security - Configure helmet to be less restrictive for development
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    })
);

// CORS - Must be before other middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// Handle preflight requests
app.options('*', cors());

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Activity logging middleware
app.use(logActivity);

// ROUTES
app.get('/', (_req, res) => {
    res.json({
        message: 'Multi-Talented System API',
        version: '1.0.0',
        status: 'running',
    });
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/menu', menuRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
