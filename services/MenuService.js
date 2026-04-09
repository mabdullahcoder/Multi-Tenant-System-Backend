/**
 * Menu Service
 */
const MenuRepository = require('../repositories/MenuRepository');
const AdminLog = require('../models/AdminLog');

const slugify = (str) =>
    str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

class MenuService {
    /* ── Categories ── */

    async createCategory(data, adminId) {
        const slug = slugify(data.name);
        const existing = await MenuRepository.findCategoryBySlug(slug);
        if (existing) {
            const err = new Error('A category with this name already exists');
            err.status = 409;
            throw err;
        }
        const category = await MenuRepository.createCategory({ ...data, slug, createdBy: adminId });
        await AdminLog.create({
            adminId,
            action: 'menu_category_created',
            actionDescription: `Menu category created: ${category.name}`,
            targetResourceId: category._id,
            resourceType: 'MenuCategory',
        }).catch(() => { });
        return category;
    }

    async getAllCategories(includeInactive = false) {
        return MenuRepository.getAllCategories(includeInactive);
    }

    async updateCategory(id, data, adminId) {
        const category = await MenuRepository.findCategoryById(id);
        if (!category) {
            const err = new Error('Category not found');
            err.status = 404;
            throw err;
        }
        if (data.name && data.name !== category.name) {
            data.slug = slugify(data.name);
            const existing = await MenuRepository.findCategoryBySlug(data.slug);
            if (existing && existing._id.toString() !== id) {
                const err = new Error('A category with this name already exists');
                err.status = 409;
                throw err;
            }
        }
        const updated = await MenuRepository.updateCategory(id, data);
        await AdminLog.create({
            adminId,
            action: 'menu_category_updated',
            actionDescription: `Menu category updated: ${updated.name}`,
            targetResourceId: id,
            resourceType: 'MenuCategory',
        }).catch(() => { });
        return updated;
    }

    async deleteCategory(id, adminId) {
        const category = await MenuRepository.findCategoryById(id);
        if (!category) {
            const err = new Error('Category not found');
            err.status = 404;
            throw err;
        }
        const hasItems = await MenuRepository.categoryHasItems(id);
        if (hasItems) {
            const err = new Error('Cannot delete category that has menu items. Remove or reassign items first.');
            err.status = 400;
            throw err;
        }
        await MenuRepository.deleteCategory(id);
        await AdminLog.create({
            adminId,
            action: 'menu_category_deleted',
            actionDescription: `Menu category deleted: ${category.name}`,
            targetResourceId: id,
            resourceType: 'MenuCategory',
        }).catch(() => { });
        return { success: true };
    }

    /* ── Menu Items ── */

    async createItem(data, adminId) {
        const item = await MenuRepository.createItem({ ...data, createdBy: adminId });
        await AdminLog.create({
            adminId,
            action: 'menu_item_created',
            actionDescription: `Menu item created: ${item.name}`,
            targetResourceId: item._id,
            resourceType: 'MenuItem',
        }).catch(() => { });
        return item;
    }

    async getAllItems(includeInactive = false) {
        return MenuRepository.getAllItems(includeInactive);
    }

    async getItemsByCategory(categoryId, includeInactive = false) {
        return MenuRepository.getItemsByCategory(categoryId, includeInactive);
    }

    async updateItem(id, data, adminId) {
        const item = await MenuRepository.findItemById(id);
        if (!item) {
            const err = new Error('Menu item not found');
            err.status = 404;
            throw err;
        }
        const updated = await MenuRepository.updateItem(id, { ...data, updatedBy: adminId });
        await AdminLog.create({
            adminId,
            action: 'menu_item_updated',
            actionDescription: `Menu item updated: ${updated.name}`,
            targetResourceId: id,
            resourceType: 'MenuItem',
        }).catch(() => { });
        return updated;
    }

    async deleteItem(id, adminId) {
        const item = await MenuRepository.findItemById(id);
        if (!item) {
            const err = new Error('Menu item not found');
            err.status = 404;
            throw err;
        }
        await MenuRepository.deleteItem(id);
        await AdminLog.create({
            adminId,
            action: 'menu_item_deleted',
            actionDescription: `Menu item deleted: ${item.name}`,
            targetResourceId: id,
            resourceType: 'MenuItem',
        }).catch(() => { });
        return { success: true };
    }

    async getMenuGrouped() {
        const categories = await MenuRepository.getAllCategories(false);
        const items = await MenuRepository.getAllItems(false);
        return categories.map((cat) => ({
            ...cat.toObject(),
            items: items.filter((i) => i.category && i.category._id && i.category._id.toString() === cat._id.toString()),
        }));
    }

    /**
     * SENIOR FIX: Public methods for fetching category and item by ID
     * Used for real-time socket updates during deletion
     */
    async getCategoryById(id) {
        return MenuRepository.findCategoryById(id);
    }

    async getItemById(id) {
        return MenuRepository.findItemById(id);
    }
}

module.exports = new MenuService();
