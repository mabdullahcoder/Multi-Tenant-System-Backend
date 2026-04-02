/**
 * Rate limiters
 * Keeps brute-force traffic under control.
 *
 * Note: Default MemoryStore is per-process. If you run multiple instances,
 * switch to a shared store (e.g., Redis) to make limits consistent.
 */

const rateLimit = require('express-rate-limit');

const getClientIp = (req) => {
    // If you later put this behind a reverse proxy, also set: app.set('trust proxy', 1)
    return req.ip || req.connection?.remoteAddress || 'unknown';
};

const sendRateLimitResponse = (req, res) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : undefined;

    // Also set Retry-After for clients that look for it.
    if (retryAfterSeconds) {
        res.set('Retry-After', String(retryAfterSeconds));
    }

    return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    });
};

// Login limiter: keyed by IP + email (avoid punishing shared-IP users too much)
const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const ip = getClientIp(req);
        const email = String(req.body?.email || '').toLowerCase().trim();
        return `${ip}:${email || 'no-email'}`;
    },
    handler: sendRateLimitResponse,
});

// Register limiter: keyed by IP
const authRegisterLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    handler: sendRateLimitResponse,
});

module.exports = {
    authLoginLimiter,
    authRegisterLimiter,
};
