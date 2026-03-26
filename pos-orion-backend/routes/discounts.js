const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Discount = require('../models/Discount');
const BusinessDiscountSettings = require('../models/BusinessDiscountSettings');
const User = require('../models/User');
const Business = require('../models/Business');
const Inventory = require('../models/Inventory');
const Category = require('../models/Category');

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

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Administrator access required' 
        });
    }
    next();
};

// GET discount settings for business (admin only)
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        let settings = await BusinessDiscountSettings.findOne({ 
            business: req.user.business 
        });

        // If no settings exist, create default ones
        if (!settings) {
            settings = await BusinessDiscountSettings.createDefaultSettings(req.user.business);
        }

        res.json({
            success: true,
            discountSettings: settings
        });
    } catch (error) {
        console.error('Get discount settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching discount settings'
        });
    }
});

// PUT update discount settings (admin only)
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
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

        let settings = await BusinessDiscountSettings.findOne({ 
            business: req.user.business 
        });

        if (!settings) {
            settings = new BusinessDiscountSettings({
                business: req.user.business
            });
        }

        // Update settings with request data
        Object.assign(settings, req.body);
        settings.lastUpdatedBy = req.user._id;

        await settings.save();

        res.json({
            success: true,
            message: 'Discount settings updated successfully',
            discountSettings: settings
        });
    } catch (error) {
        console.error('Update discount settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating discount settings'
        });
    }
});

// GET all discounts for business
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, type, search, sort = '-createdAt' } = req.query;
        
        let query = { business: req.user.business };
        
        // Apply filters
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Get discounts
        const discounts = await Discount.find(query)
            .sort(sort)
            .populate('categories', 'name')
            .populate('products', 'name price')
            .populate('bogo.buyProducts', 'name price')
            .populate('bogo.getProducts', 'name price')
            .lean();
        
        // Format discounts for frontend
        const formattedDiscounts = discounts.map(discount => {
            // Calculate validity
            const now = new Date();
            const isExpired = discount.validUntil && new Date(discount.validUntil) < now;
            
            return {
                ...discount,
                isCurrentlyValid: discount.status === 'active' && !isExpired,
                formattedValidFrom: discount.validFrom ? new Date(discount.validFrom).toLocaleDateString() : 'Immediately',
                formattedValidUntil: discount.validUntil ? new Date(discount.validUntil).toLocaleDateString() : 'No expiry',
                days: discount.conditions?.days?.map(day => 
                    day.charAt(0).toUpperCase() + day.slice(1)
                ) || []
            };
        });
        
        res.json({
            success: true,
            discounts: formattedDiscounts,
            total: formattedDiscounts.length
        });
    } catch (error) {
        console.error('Get discounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching discounts'
        });
    }
});

// GET single discount
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const discount = await Discount.findOne({
            _id: req.params.id,
            business: req.user.business
        })
        .populate('categories', 'name')
        .populate('products', 'name price')
        .populate('bogo.buyProducts', 'name price')
        .populate('bogo.getProducts', 'name price')
        .lean();
        
        if (!discount) {
            return res.status(404).json({
                success: false,
                message: 'Discount not found'
            });
        }
        
        res.json({
            success: true,
            discount: discount
        });
    } catch (error) {
        console.error('Get discount error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching discount'
        });
    }
});

// POST create new discount (admin only)
router.post('/', authenticateToken, requireAdmin, [
    body('name').trim().notEmpty().withMessage('Discount name is required'),
    body('type').isIn(['percentage', 'fixed', 'bogo', 'bulk']).withMessage('Invalid discount type'),
    body('value').optional().isFloat({ min: 0 }).withMessage('Discount value must be positive'),
    body('validFrom').optional().isISO8601().withMessage('Invalid start date format'),
    body('validUntil').optional().isISO8601().withMessage('Invalid end date format')
], async (req, res) => {
    try {
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
        
        // Check if discount with same name already exists
        const existingDiscount = await Discount.findOne({
            name: req.body.name,
            business: req.user.business
        });
        
        if (existingDiscount) {
            return res.status(400).json({
                success: false,
                errors: [{
                    field: 'name',
                    message: 'Discount with this name already exists'
                }]
            });
        }
        
        // Validate based on type
        if (req.body.type === 'percentage' || req.body.type === 'fixed') {
            if (!req.body.value) {
                return res.status(400).json({
                    success: false,
                    errors: [{
                        field: 'value',
                        message: 'Discount value is required for this type'
                    }]
                });
            }
            
            if (req.body.type === 'percentage' && (req.body.value < 0 || req.body.value > 100)) {
                return res.status(400).json({
                    success: false,
                    errors: [{
                        field: 'value',
                        message: 'Percentage must be between 0 and 100'
                    }]
                });
            }
        }
        
        if (req.body.type === 'bogo') {
            if (!req.body.bogo || !req.body.bogo.buyQuantity || !req.body.bogo.getQuantity) {
                return res.status(400).json({
                    success: false,
                    errors: [{
                        field: 'bogo',
                        message: 'BOGO configuration is incomplete'
                    }]
                });
            }
        }
        
        // Create discount
        const discount = new Discount({
            ...req.body,
            business: req.user.business,
            createdBy: req.user._id,
            status: 'active'
        });
        
        await discount.save();
        
        // Populate for response
        await discount.populate('categories', 'name');
        await discount.populate('products', 'name price');
        await discount.populate('bogo.buyProducts', 'name price');
        await discount.populate('bogo.getProducts', 'name price');
        
        res.status(201).json({
            success: true,
            message: 'Discount created successfully',
            discount: discount
        });
    } catch (error) {
        console.error('Create discount error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating discount',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT update discount (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
    body('name').trim().notEmpty().withMessage('Discount name is required'),
    body('type').isIn(['percentage', 'fixed', 'bogo', 'bulk']).withMessage('Invalid discount type'),
    body('value').optional().isFloat({ min: 0 }).withMessage('Discount value must be positive'),
    body('validFrom').optional().isISO8601().withMessage('Invalid start date format'),
    body('validUntil').optional().isISO8601().withMessage('Invalid end date format')
], async (req, res) => {
    try {
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
        
        // Find discount
        const discount = await Discount.findOne({
            _id: req.params.id,
            business: req.user.business
        });
        
        if (!discount) {
            return res.status(404).json({
                success: false,
                message: 'Discount not found'
            });
        }
        
        // Check if name changed and conflicts
        if (req.body.name !== discount.name) {
            const existingDiscount = await Discount.findOne({
                name: req.body.name,
                business: req.user.business,
                _id: { $ne: req.params.id }
            });
            
            if (existingDiscount) {
                return res.status(400).json({
                    success: false,
                    errors: [{
                        field: 'name',
                        message: 'Discount with this name already exists'
                    }]
                });
            }
        }
        
        // Validate based on type
        if (req.body.type === 'percentage' || req.body.type === 'fixed') {
            if (!req.body.value) {
                return res.status(400).json({
                    success: false,
                    errors: [{
                        field: 'value',
                        message: 'Discount value is required for this type'
                    }]
                });
            }
            
            if (req.body.type === 'percentage' && (req.body.value < 0 || req.body.value > 100)) {
                return res.status(400).json({
                    success: false,
                    errors: [{
                        field: 'value',
                        message: 'Percentage must be between 0 and 100'
                    }]
                });
            }
        }
        
        // Update discount
        Object.assign(discount, req.body);
        await discount.save();
        
        // Populate for response
        await discount.populate('categories', 'name');
        await discount.populate('products', 'name price');
        await discount.populate('bogo.buyProducts', 'name price');
        await discount.populate('bogo.getProducts', 'name price');
        
        res.json({
            success: true,
            message: 'Discount updated successfully',
            discount: discount
        });
    } catch (error) {
        console.error('Update discount error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating discount',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PATCH update discount status (admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['active', 'inactive', 'expired'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }
        
        const discount = await Discount.findOneAndUpdate(
            {
                _id: req.params.id,
                business: req.user.business
            },
            { status: status },
            { new: true }
        );
        
        if (!discount) {
            return res.status(404).json({
                success: false,
                message: 'Discount not found'
            });
        }
        
        res.json({
            success: true,
            message: `Discount ${status} successfully`,
            discount: discount
        });
    } catch (error) {
        console.error('Update discount status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating discount status'
        });
    }
});

// DELETE discount (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const discount = await Discount.findOneAndDelete({
            _id: req.params.id,
            business: req.user.business
        });
        
        if (!discount) {
            return res.status(404).json({
                success: false,
                message: 'Discount not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Discount deleted successfully'
        });
    } catch (error) {
        console.error('Delete discount error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting discount'
        });
    }
});

// GET applicable discounts for an order
router.post('/applicable', authenticateToken, async (req, res) => {
    try {
        const { items, orderTotal, customerId } = req.body;
        
        // Get all active discounts for business
        const discounts = await Discount.find({
            business: req.user.business,
            status: 'active'
        })
        .populate('products', 'name price')
        .populate('categories', 'name')
        .populate('bogo.buyProducts', 'name price')
        .populate('bogo.getProducts', 'name price');
        
        // Filter applicable discounts
        const applicableDiscounts = [];
        const now = new Date();
        
        for (const discount of discounts) {
            // Check date validity
            if (discount.validFrom && now < discount.validFrom) continue;
            if (discount.validUntil && now > discount.validUntil) {
                discount.status = 'expired';
                await discount.save();
                continue;
            }
            
            // Check one per customer restriction
            if (discount.onePerCustomer && customerId) {
                // In a real app, check if customer has used this discount before
                // For now, we'll skip this check
            }
            
            // Check maximum uses
            if (discount.maxUses && discount.usedCount >= discount.maxUses) {
                discount.status = 'inactive';
                await discount.save();
                continue;
            }
            
            // Calculate discount amount
            const discountResult = discount.calculateDiscount(items, orderTotal);
            
            if (discountResult.discountAmount > 0) {
                applicableDiscounts.push({
                    discount: discount,
                    amount: discountResult.discountAmount,
                    applicableItems: discountResult.applicableItems,
                    type: discountResult.discountType,
                    name: discountResult.discountName
                });
            }
        }
        
        // Sort by priority or amount
        applicableDiscounts.sort((a, b) => b.amount - a.amount);
        
        res.json({
            success: true,
            applicableDiscounts: applicableDiscounts,
            totalApplicableDiscounts: applicableDiscounts.length
        });
    } catch (error) {
        console.error('Get applicable discounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while calculating applicable discounts'
        });
    }
});

// POST apply discount to order
router.post('/apply/:id', authenticateToken, async (req, res) => {
    try {
        const { items, orderTotal } = req.body;
        
        const discount = await Discount.findOne({
            _id: req.params.id,
            business: req.user.business,
            status: 'active'
        });
        
        if (!discount) {
            return res.status(404).json({
                success: false,
                message: 'Discount not found or not active'
            });
        }
        
        // Calculate discount
        const discountResult = discount.calculateDiscount(items, orderTotal);
        
        if (discountResult.discountAmount === 0) {
            return res.status(400).json({
                success: false,
                message: 'Discount not applicable to this order'
            });
        }
        
        // Increment usage count
        discount.usedCount += 1;
        if (discount.maxUses && discount.usedCount >= discount.maxUses) {
            discount.status = 'inactive';
        }
        await discount.save();
        
        res.json({
            success: true,
            discountAmount: discountResult.discountAmount,
            applicableItems: discountResult.applicableItems,
            discountName: discountResult.discountName,
            discountType: discountResult.discountType,
            newTotal: orderTotal - discountResult.discountAmount,
            discountDetails: {
                id: discount._id,
                name: discount.name,
                type: discount.type,
                value: discount.value
            }
        });
    } catch (error) {
        console.error('Apply discount error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while applying discount'
        });
    }
});

// GET discount statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const businessId = req.user.business;
        
        // Get total discounts count
        const totalDiscounts = await Discount.countDocuments({
            business: businessId
        });
        
        // Get active discounts count
        const activeDiscounts = await Discount.countDocuments({
            business: businessId,
            status: 'active'
        });
        
        // Get expired discounts count
        const expiredDiscounts = await Discount.countDocuments({
            business: businessId,
            status: 'expired'
        });
        
        // Get most used discounts
        const mostUsedDiscounts = await Discount.find({
            business: businessId,
            usedCount: { $gt: 0 }
        })
        .sort({ usedCount: -1 })
        .limit(5)
        .lean();
        
        // Get discount type distribution
        const typeDistribution = await Discount.aggregate([
            { $match: { business: mongoose.Types.ObjectId(businessId) } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalUses: { $sum: '$usedCount' }
                }
            }
        ]);
        
        res.json({
            success: true,
            stats: {
                totalDiscounts,
                activeDiscounts,
                expiredDiscounts,
                mostUsedDiscounts,
                typeDistribution
            }
        });
    } catch (error) {
        console.error('Get discount stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching discount statistics'
        });
    }
});

// In routes/discounts.js, add this endpoint
router.post('/applicable', authenticateToken, async (req, res) => {
    try {
        const { items, orderTotal, customerId } = req.body;
        
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                message: 'Items array is required'
            });
        }

        // Get all active discounts for business
        const discounts = await Discount.find({
            business: req.user.business,
            status: 'active'
        }).populate('products categories');

        const applicableDiscounts = [];
        const now = new Date();

        for (const discount of discounts) {
            // Check validity
            if (!discount.isValid()) continue;

            // Check one per customer restriction
            if (discount.onePerCustomer && customerId) {
                // In a real app, check if customer has used this discount before
                const customerUsed = await Transaction.exists({
                    'customer._id': customerId,
                    'discountsApplied.discountId': discount._id
                });
                
                if (customerUsed) continue;
            }

            // Check maximum uses
            if (discount.maxUses && discount.usedCount >= discount.maxUses) continue;

            // Calculate discount amount
            const discountResult = discount.calculateDiscount(items, orderTotal);
            
            if (discountResult.discountAmount > 0) {
                applicableDiscounts.push({
                    discount: discount,
                    amount: discountResult.discountAmount,
                    applicableItems: discountResult.applicableItems,
                    type: discountResult.discountType,
                    name: discountResult.discountName
                });
            }
        }

        // Sort by priority or amount
        applicableDiscounts.sort((a, b) => b.amount - a.amount);

        res.json({
            success: true,
            applicableDiscounts: applicableDiscounts,
            totalApplicableDiscounts: applicableDiscounts.length
        });
    } catch (error) {
        console.error('Get applicable discounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while calculating applicable discounts'
        });
    }
});

router.post('/increment-usage-batch', authenticateToken, async (req, res) => {
    try {
        const { discountIds, incrementBy = 1 } = req.body;

        if (!discountIds || !Array.isArray(discountIds) || discountIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'discountIds array is required'
            });
        }

        // Update all discounts at once
        const result = await Discount.updateMany(
            { _id: { $in: discountIds } },
            { $inc: { usedCount: incrementBy } }
        );

        res.json({
            success: true,
            message: `Updated ${result.modifiedCount} discounts`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error incrementing discount usage:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to increment discount usage',
            error: error.message
        });
    }
});

module.exports = router;