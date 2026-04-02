/**
 * Logger Utility
 * Centralized logging with different levels
 */

const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
};

const shouldLog = (level) => {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'test') return false;
    if (env === 'production' && level === LOG_LEVELS.DEBUG) return false;
    return true;
};

const formatMessage = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
};

const logger = {
    error: (message, error = null) => {
        if (!shouldLog(LOG_LEVELS.ERROR)) return;
        const meta = error ? { error: error.message, stack: error.stack } : {};
        console.error(formatMessage(LOG_LEVELS.ERROR, message, meta));
    },

    warn: (message, meta = {}) => {
        if (!shouldLog(LOG_LEVELS.WARN)) return;
        console.warn(formatMessage(LOG_LEVELS.WARN, message, meta));
    },

    info: (message, meta = {}) => {
        if (!shouldLog(LOG_LEVELS.INFO)) return;
        console.log(formatMessage(LOG_LEVELS.INFO, message, meta));
    },

    debug: (message, meta = {}) => {
        if (!shouldLog(LOG_LEVELS.DEBUG)) return;
        console.log(formatMessage(LOG_LEVELS.DEBUG, message, meta));
    },
};

module.exports = logger;
