/**
 * Response Formatter
 * Standardizes API responses
 */

const sendSuccess = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        ...(meta && { meta }),
    });
};

const sendError = (res, statusCode = 400, message = 'Error', errors = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        ...(errors && { errors }),
    });
};

module.exports = {
    sendSuccess,
    sendError,
};
