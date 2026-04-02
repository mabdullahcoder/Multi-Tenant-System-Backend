/**
 * MenuCategory Model
 */
const mongoose = require('mongoose');

const menuCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
            unique: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        description: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

menuCategorySchema.index({ slug: 1 });
menuCategorySchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('MenuCategory', menuCategorySchema);
