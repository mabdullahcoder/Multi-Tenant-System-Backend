/**
 * Menu Repository
 */
const MenuItem = require('../models/MenuItem');
const MenuCategory = require('../models/MenuCategory');

class MenuRepository {
    /* ── Categories ── */

    async createCategory(data) {
        return MenuCategory.create(data);
    }

    async findCategoryById(id) {
        return MenuCategory.findById(id);
    }

    async findCategoryBySlug(slug) {
        return MenuCategory.findOne({ slug });
    }

    async getAllCategories(includeInactive = false) {
        const query = includeInactive ? {} : { isActive: true };
        return MenuCategory.find(query).sort({ sortOrder: 1, name: 1 });
    }

    async updateCategory(id, data) {
        return MenuCategory.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }

    async deleteCategory(id) {
        return MenuCategory.findByIdAndDelete(id);
    }

    async categoryHasItems(categoryId) {
        const count = await MenuItem.countDocuments({ category: categoryId });
        return count > 0;
    }

    /* ── Menu Items ── */

    async createItem(data) {
        return MenuItem.create(data);
    }

    async findItemById(id) {
        return MenuItem.findById(id).populate('category', 'name slug');
    }

    async getItemsByCategory(categoryId, includeInactive = false) {
        const query = { category: categoryId, ...(includeInactive ? {} : { isActive: true }) };
        return MenuItem.find(query).sort({ sortOrder: 1, name: 1 }).populate('category', 'name slug');
    }

    async getAllItems(includeInactive = false) {
        const query = includeInactive ? {} : { isActive: true };
        return MenuItem.find(query).sort({ sortOrder: 1 }).populate('category', 'name slug');
    }

    async updateItem(id, data) {
        return MenuItem.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('category', 'name slug');
    }

    async deleteItem(id) {
        return MenuItem.findByIdAndDelete(id);
    }

    async searchItems(query) {
        return MenuItem.find({
            isActive: true,
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } },
            ],
        }).populate('category', 'name slug');
    }
}

module.exports = new MenuRepository();
