/**
 * Validation Schemas
 * Input validation using joi
 */

const Joi = require('joi');

const authValidationSchemas = {
    register: Joi.object({
        firstName: Joi.string().required().trim().messages({
            'string.empty': 'First name is required',
        }),
        lastName: Joi.string().required().trim().messages({
            'string.empty': 'Last name is required',
        }),
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide valid email',
            'string.empty': 'Email is required',
        }),
        password: Joi.string().min(6).required().messages({
            'string.min': 'Password must be at least 6 characters',
            'string.empty': 'Password is required',
        }),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
            'any.only': 'Passwords do not match',
            'string.empty': 'Confirm password is required',
        }),
    }),

    login: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide valid email',
            'string.empty': 'Email is required',
        }),
        password: Joi.string().required().messages({
            'string.empty': 'Password is required',
        }),
    }),

    changePassword: Joi.object({
        currentPassword: Joi.string().required().messages({
            'string.empty': 'Current password is required',
        }),
        newPassword: Joi.string().min(6).required().messages({
            'string.min': 'New password must be at least 6 characters',
            'string.empty': 'New password is required',
        }),
        confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
            'any.only': 'Passwords do not match',
            'string.empty': 'Confirm password is required',
        }),
    }),
};

const orderValidationSchemas = {
    createOrder: Joi.object({
        // Support for multi-item orders
        items: Joi.array()
            .items(
                Joi.object({
                    productId: Joi.string().optional().allow(null),
                    productName: Joi.string().required().trim().messages({
                        'string.empty': 'Product name is required',
                    }),
                    productDescription: Joi.string().optional().trim().allow('').default(''),
                    quantity: Joi.number().min(1).required().messages({
                        'number.base': 'Quantity must be a number',
                        'number.min': 'Quantity must be at least 1',
                    }),
                    price: Joi.number().min(0).required().messages({
                        'number.base': 'Price must be a number',
                        'number.min': 'Price cannot be negative',
                    }),
                    subtotal: Joi.number().min(0).required().messages({
                        'number.base': 'Subtotal must be a number',
                        'number.min': 'Subtotal cannot be negative',
                    }),
                })
            )
            .optional()
            .allow(null),
        // Support for backward compatibility - single-item orders
        productName: Joi.string().optional().trim(),
        productDescription: Joi.string().optional().trim(),
        quantity: Joi.number().min(1).optional().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be at least 1',
        }),
        price: Joi.number().min(0).optional().messages({
            'number.base': 'Price must be a number',
            'number.min': 'Price cannot be negative',
        }),
        totalAmount: Joi.number().min(0).optional().messages({
            'number.base': 'Total amount must be a number',
            'number.min': 'Total amount cannot be negative',
        }),
        deliveryAddress: Joi.object({
            street: Joi.string().required().trim().messages({
                'string.empty': 'Street address is required',
            }),
            city: Joi.string().required().trim().messages({
                'string.empty': 'City is required',
            }),
            state: Joi.string().optional().allow('').trim(),
            country: Joi.string().optional().allow('').trim(),
            zipCode: Joi.string().required().trim().messages({
                'string.empty': 'ZIP code is required',
            }),
        }).required().messages({
            'any.required': 'Delivery address is required',
        }),
        paymentMethod: Joi.string()
            .valid('credit_card', 'debit_card', 'upi', 'bank_transfer', 'cash_on_delivery')
            .optional()
            .default('credit_card'),
        notes: Joi.string().optional().trim().allow(''),
    }).custom((value, helpers) => {
        // Validate that either items array or single-item fields are provided
        const hasItems = value.items && Array.isArray(value.items) && value.items.length > 0;
        const hasSingleItem = value.productName && value.quantity && value.price;

        if (!hasItems && !hasSingleItem) {
            return helpers.error(
                'any.custom',
                { message: 'Either items array or single item details (productName, quantity, price) must be provided' }
            );
        }

        return value;
    }, 'validate-order-items'),
};

const updateItemsSchema = Joi.object({
    items: Joi.array()
        .items(
            Joi.object({
                productId: Joi.string().optional().allow(null),
                productName: Joi.string().required().trim().messages({
                    'string.empty': 'Product name is required',
                }),
                productDescription: Joi.string().optional().trim().allow('').default(''),
                quantity: Joi.number().min(1).required().messages({
                    'number.base': 'Quantity must be a number',
                    'number.min': 'Quantity must be at least 1',
                }),
                price: Joi.number().min(0).required().messages({
                    'number.base': 'Price must be a number',
                    'number.min': 'Price cannot be negative',
                }),
                subtotal: Joi.number().min(0).required().messages({
                    'number.base': 'Subtotal must be a number',
                    'number.min': 'Subtotal cannot be negative',
                }),
            })
        )
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one item is required',
            'any.required': 'Items are required',
        }),
});

const appendItemsSchema = Joi.object({
    items: Joi.array()
        .items(
            Joi.object({
                productId: Joi.string().optional().allow(null),
                productName: Joi.string().required().trim().messages({
                    'string.empty': 'Product name is required',
                }),
                productDescription: Joi.string().optional().trim().allow('').default(''),
                quantity: Joi.number().min(1).required().messages({
                    'number.base': 'Quantity must be a number',
                    'number.min': 'Quantity must be at least 1',
                }),
                price: Joi.number().min(0).required().messages({
                    'number.base': 'Price must be a number',
                    'number.min': 'Price cannot be negative',
                }),
                subtotal: Joi.number().min(0).required().messages({
                    'number.base': 'Subtotal must be a number',
                    'number.min': 'Subtotal cannot be negative',
                }),
            })
        )
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one item is required',
            'any.required': 'Items are required',
        }),
});

const userValidationSchemas = {
    updateProfile: Joi.object({
        firstName: Joi.string().trim().min(1).required().messages({
            'string.empty': 'First name is required',
            'string.min': 'First name is required',
        }),
        lastName: Joi.string().trim().min(1).required().messages({
            'string.empty': 'Last name is required',
            'string.min': 'Last name is required',
        }),
        phone: Joi.string().trim().allow('').optional(),
        address: Joi.string().trim().allow('').optional(),
        city: Joi.string().trim().allow('').optional(),
        state: Joi.string().trim().allow('').optional(),
        country: Joi.string().trim().allow('').optional(),
        zipCode: Joi.string().trim().allow('').optional(),
    }),
};

const validateInput = (schema, data) => {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const errors = error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
        }));
        return { valid: false, errors };
    }

    return { valid: true, data: value };
};

module.exports = {
    authValidationSchemas,
    orderValidationSchemas,
    appendItemsSchema,
    updateItemsSchema,
    userValidationSchemas,
    validateInput,
};
