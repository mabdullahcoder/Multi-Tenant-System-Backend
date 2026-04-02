/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    // Prevent sending response twice
    if (res.headersSent) {
        return next(err);
    }

    // Default error status and message
    let status = err.status || err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || null;

    // Custom validation errors (from validationSchemas)
    if (err.errors && Array.isArray(err.errors)) {
        status = 400;
        message = 'Validation failed';
        errors = err.errors;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        status = 400;
        message = Object.values(err.errors)
            .map((e) => e.message)
            .join(', ');
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        status = 400;
        const field = Object.keys(err.keyPattern)[0];
        message = `${field} already exists`;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        status = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        status = 401;
        message = 'Token expired';
    }

    // Log error
    logger.error(message, err);

    // Send response
    return res.status(status).json({
        success: false,
        message,
        ...(errors && { errors }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = errorHandler;
