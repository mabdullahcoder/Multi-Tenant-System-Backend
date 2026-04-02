/**
 * Menu Routes
 * Public: GET (read menu)
 * Admin/Super-admin: POST, PUT, DELETE (manage menu)
 */
const express = require('express');
const router = express.Router();
const MenuController = require('../controllers/MenuController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/authorizationMiddleware');

const adminOnly = [authMiddleware, authorizeRoles('admin', 'super-admin')];

/* ── Public ── */
router.get('/grouped', (req, res, next) => MenuController.getMenuGrouped(req, res, next));
router.get('/categories', (req, res, next) => MenuController.getCategories(req, res, next));
router.get('/items', (req, res, next) => MenuController.getItems(req, res, next));

/* ── Admin: Categories ── */
router.post('/categories', ...adminOnly, (req, res, next) => MenuController.createCategory(req, res, next));
router.put('/categories/:id', ...adminOnly, (req, res, next) => MenuController.updateCategory(req, res, next));
router.delete('/categories/:id', ...adminOnly, (req, res, next) => MenuController.deleteCategory(req, res, next));

/* ── Admin: Items ── */
router.post('/items', ...adminOnly, (req, res, next) => MenuController.createItem(req, res, next));
router.put('/items/:id', ...adminOnly, (req, res, next) => MenuController.updateItem(req, res, next));
router.delete('/items/:id', ...adminOnly, (req, res, next) => MenuController.deleteItem(req, res, next));

module.exports = router;
