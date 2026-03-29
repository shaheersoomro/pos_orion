const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Permission = require('../models/Permission');

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

// GET all permissions for business
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        let permissions = await Permission.findOne({ business: req.user.business });
        
        if (!permissions) {
            // Create default permissions
            permissions = new Permission({
                business: req.user.business,
                roles: Permission.getDefaultPermissions(),
                createdBy: req.user._id
            });
            await permissions.save();
        }
        
        res.json({
            success: true,
            permissions: permissions
        });
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching permissions'
        });
    }
});

// UPDATE permissions
router.put('/', authenticateToken, requireAdmin, [
    body('roles').isObject().withMessage('Roles object is required')
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
        
        let permissions = await Permission.findOne({ business: req.user.business });
        
        if (!permissions) {
            permissions = new Permission({
                business: req.user.business,
                createdBy: req.user._id
            });
        }
        
        // Update permissions
        permissions.roles = req.body.roles;
        permissions.updatedBy = req.user._id;
        
        await permissions.save();
        
        res.json({
            success: true,
            message: 'Permissions updated successfully',
            permissions: permissions
        });
    } catch (error) {
        console.error('Update permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating permissions'
        });
    }
});

// GET user-specific permissions
router.get('/user/:userId', authenticateToken, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if same business
        if (targetUser.business.toString() !== req.user.business.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Cannot access user from another business'
            });
        }
        
        const permissions = await Permission.findOne({ business: req.user.business });
        
        if (!permissions) {
            // Return default permissions based on role
            const defaultPermissions = Permission.getDefaultPermissions();
            return res.json({
                success: true,
                permissions: {
                    role: targetUser.role,
                    ...defaultPermissions[targetUser.role]
                }
            });
        }
        
        const rolePermissions = permissions.roles[targetUser.role] || permissions.roles.cashier;
        
        res.json({
            success: true,
            permissions: {
                role: targetUser.role,
                ...rolePermissions
            }
        });
    } catch (error) {
        console.error('Get user permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user permissions'
        });
    }
});

module.exports = router;