const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Category = require('../models/Category');
const User = require('../models/User');
const Inventory = require('../models/Inventory');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.error('JWT verification error:', err.message);
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }

        try {
            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('User lookup error:', error);
            res.status(500).json({ success: false, message: 'Server error during authentication' });
        }
    });
};

// Default categories data
const DEFAULT_CATEGORIES = [
    { name: 'Coffee', description: 'Coffee products and beverages' },
    { name: 'Food', description: 'Food items and meals' },
    { name: 'Services', description: 'Services provided' },
    { name: 'Bakery', description: 'Bakery items and pastries' },
    { name: 'Tea', description: 'Tea products and beverages' },
    { name: 'Other', description: 'Other miscellaneous items' }
];

// Initialize default categories for a business
const initializeDefaultCategories = async (businessId, userId) => {
    try {
        const categories = [];
        
        for (const defaultCat of DEFAULT_CATEGORIES) {
            const existingCategory = await Category.findOne({
                name: defaultCat.name,
                business: businessId
            });

            if (!existingCategory) {
                const category = new Category({
                    name: defaultCat.name,
                    description: defaultCat.description,
                    business: businessId,
                    createdBy: userId,
                    isDefault: true,
                    isActive: true
                });
                await category.save();
                categories.push(category);
            }
        }
        
        return categories;
    } catch (error) {
        console.error('Error initializing default categories:', error);
        throw error;
    }
};

// GET all categories for the business
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Check if business has any categories
        const categoryCount = await Category.countDocuments({ 
            business: req.user.business,
            isActive: true 
        });

        // If no categories exist, initialize default ones
        if (categoryCount === 0) {
            await initializeDefaultCategories(req.user.business, req.user._id);
        }

        const categories = await Category.find({ 
            business: req.user.business,
            isActive: true 
        })
        .sort({ name: 1 })
        .lean();

        res.json({
            success: true,
            categories: categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching categories'
        });
    }
});

// GET category with product count
router.get('/:id/products-count', authenticateToken, async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            business: req.user.business,
            isActive: true
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Count products in this category
        const productCount = await Inventory.countDocuments({
            category: req.params.id,
            business: req.user.business
        });

        res.json({
            success: true,
            category: category,
            productCount: productCount
        });
    } catch (error) {
        console.error('Get category product count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching category details'
        });
    }
});

// POST create new category
router.post('/', authenticateToken, [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('description').optional().trim()
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array().map(err => ({
                    field: err.path,
                    message: err.msg
                }))
            });
        }

        // Check if category with same name already exists in business
        const existingCategory = await Category.findOne({
            name: req.body.name,
            business: req.user.business,
            isActive: true
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                errors: [{
                    field: 'name',
                    message: 'Category with this name already exists'
                }]
            });
        }

        // Create new category
        const category = new Category({
            name: req.body.name,
            description: req.body.description || '',
            business: req.user.business,
            createdBy: req.user._id,
            isDefault: false,
            isActive: true
        });

        await category.save();

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            category: category
        });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating category',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT update category
router.put('/:id', authenticateToken, [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('description').optional().trim()
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array().map(err => ({
                    field: err.path,
                    message: err.msg
                }))
            });
        }

        const category = await Category.findOne({
            _id: req.params.id,
            business: req.user.business,
            isActive: true
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Check if category is default (can't edit default category name)
        if (category.isDefault && req.body.name !== category.name) {
            return res.status(400).json({
                success: false,
                message: 'Cannot rename default categories'
            });
        }

        // Check if new name already exists (excluding current category)
        const existingCategory = await Category.findOne({
            name: req.body.name,
            business: req.user.business,
            _id: { $ne: req.params.id },
            isActive: true
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                errors: [{
                    field: 'name',
                    message: 'Category with this name already exists'
                }]
            });
        }

        // Update category
        category.name = req.body.name;
        category.description = req.body.description || '';
        await category.save();

        res.json({
            success: true,
            message: 'Category updated successfully',
            category: category
        });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating category'
        });
    }
});

// DELETE category (hard delete - only if unused)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            business: req.user.business,
            isActive: true
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Check if category is default (can't delete default categories)
        if (category.isDefault) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete default categories'
            });
        }

        // Check if category has any associated products
        const productCount = await Inventory.countDocuments({
            category: req.params.id,
            business: req.user.business
        });

        if (productCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category with associated products. Please reassign or delete products first.',
                productCount: productCount
            });
        }

        // ⭐⭐⭐ HARD DELETE - Remove from database ⭐⭐⭐
        await Category.deleteOne({ _id: req.params.id });

        res.json({
            success: true,
            message: 'Category deleted permanently'
        });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting category'
        });
    }
});

module.exports = router;