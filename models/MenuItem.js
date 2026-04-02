/**
 * MenuItem Model
 */
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Item name is required'],
            trim: true,
        },
        description: { type: String, trim: true, default: '' },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },
        originalPrice: { type: Number, default: null },
        image: { type: String, trim: true, default: '' },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MenuCategory',
            required: [true, 'Category is required'],
        },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

menuItemSchema.index({ category: 1, isActive: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('MenuItem', menuItemSchema);
