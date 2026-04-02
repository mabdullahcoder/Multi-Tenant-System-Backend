/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middlewares/authMiddleware');
const { authLoginLimiter, authRegisterLimiter } = require('../middlewares/rateLimiter');

// Public routes
router.post('/register', authRegisterLimiter, (req, res, next) =>
    AuthController.register(req, res, next)
);
router.post('/login', authLoginLimiter, (req, res, next) => AuthController.login(req, res, next));

// Protected routes
router.post('/logout', authMiddleware, (req, res, next) => AuthController.logout(req, res, next));
router.post('/change-password', authMiddleware, (req, res, next) =>
    AuthController.changePassword(req, res, next)
);
router.get('/verify-token', authMiddleware, (req, res, next) =>
    AuthController.verifyToken(req, res, next)
);

module.exports = router;
