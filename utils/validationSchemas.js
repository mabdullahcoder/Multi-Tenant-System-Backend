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
        productName: Joi.string().required().trim().messages({
            'string.empty': 'Product name is required',
        }),
        productDescription: Joi.string().optional().trim(),
        quantity: Joi.number().min(1).required().messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be at least 1',
        }),
        price: Joi.number().min(0).required().messages({
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
    }),
};

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
    userValidationSchemas,
    validateInput,
};
