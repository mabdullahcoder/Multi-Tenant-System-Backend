/**
 * Order Model
 * Manages order data with status tracking and payment information
 */

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            unique: true,
            sparse: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },
        // NEW: Support for multiple items per order
        items: [
            {
                productId: mongoose.Schema.Types.ObjectId,
                productName: {
                    type: String,
                    required: [true, 'Product name is required'],
                    trim: true,
                },
                productDescription: {
                    type: String,
                    trim: true,
                    default: '',
                },
                quantity: {
                    type: Number,
                    required: [true, 'Quantity is required'],
                    min: [1, 'Quantity must be at least 1'],
                },
                price: {
                    type: Number,
                    required: [true, 'Price is required'],
                    min: [0, 'Price cannot be negative'],
                },
                subtotal: {
                    type: Number,
                    required: true,
                },
            },
        ],
        // DEPRECATED: Kept for backward compatibility with single-item orders
        productName: {
            type: String,
            trim: true,
            default: null,
        },
        productDescription: {
            type: String,
            trim: true,
            default: null,
        },
        quantity: {
            type: Number,
            min: [1, 'Quantity must be at least 1'],
            default: null,
        },
        price: {
            type: Number,
            min: [0, 'Price cannot be negative'],
            default: null,
        },
        totalAmount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
            default: 'pending',
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending',
        },
        paymentMethod: {
            type: String,
            enum: ['credit_card', 'debit_card', 'upi', 'bank_transfer', 'cash_on_delivery'],
            default: 'credit_card',
        },
        deliveryAddress: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String,
        },
        trackingNumber: {
            type: String,
            default: null,
        },
        estimatedDeliveryDate: {
            type: Date,
            default: null,
        },
        actualDeliveryDate: {
            type: Date,
            default: null,
        },
        notes: {
            type: String,
            trim: true,
        },
        cancellationReason: {
            type: String,
            default: null,
        },
        cancelledBy: {
            type: String,
            enum: ['user', 'admin', 'system'],
            default: "user",
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        confirmedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Pre-save middleware to generate Order ID
orderSchema.pre('save', async function (next) {
    if (!this.orderId) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderId = `ORD-${Date.now()}-${count + 1}`;
    }

    // Handle multi-item orders
    if (this.items && this.items.length > 0) {
        // Calculate total from items array
        this.totalAmount = this.items.reduce((sum, item) => sum + (item.subtotal || item.price * item.quantity), 0);
        // For multi-item orders, leave old fields null
        if (this.items.length > 1) {
            this.productName = null;
            this.productDescription = null;
            this.quantity = null;
            this.price = null;
        }
    } else if (this.quantity && this.price) {
        // Backward compatibility: handle single-item orders created without items array
        this.totalAmount = this.price * this.quantity;
    }

    next();
});

// Index for faster queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderId: 1 });

module.exports = mongoose.model('Order', orderSchema);
