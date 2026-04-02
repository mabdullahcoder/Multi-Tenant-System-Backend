/**
 * User Routes
 */

const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/authorizationMiddleware');

// Protected routes (user)
router.get('/profile', authMiddleware, (req, res, next) =>
    UserController.getProfile(req, res, next)
);
router.put('/profile', authMiddleware, (req, res, next) =>
    UserController.updateProfile(req, res, next)
);

// Admin-only routes
router.get(
    '/',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => UserController.getAllUsers(req, res, next)
);

router.post(
    '/create',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => UserController.createUser(req, res, next)
);

router.get(
    '/stats',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => UserController.getUserStats(req, res, next)
);

router.get(
    '/search',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => UserController.searchUsers(req, res, next)
);

router.get(
    '/:userId',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => UserController.getUserDetail(req, res, next)
);

router.patch(
    '/:userId/block',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => UserController.blockUser(req, res, next)
);

router.patch(
    '/:userId/unblock',
    authMiddleware,
    authorizeRoles('admin', 'super-admin'),
    (req, res, next) => UserController.unblockUser(req, res, next)
);

module.exports = router;
