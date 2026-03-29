const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
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

// Middleware to check user management permission
const requireUserManagementPermission = async (req, res, next) => {
    try {
        const permissions = await Permission.findOne({ business: req.user.business });
        
        if (!permissions) {
            // If no permissions configured, use default: only admin can manage users
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only admins can manage users'
                });
            }
            return next();
        }
        
        const hasPermission = permissions.hasPermission(req.user.role, 'canManageUsers');
        
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'You don\'t have permission to manage users'
            });
        }
        
        next();
    } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking permissions'
        });
    }
};

// GET all users for the business (with role-based permissions)
router.get('/', authenticateToken, async (req, res) => {
    try {
        // All users can see all users in the same business
        const users = await User.find({ business: req.user.business })
            .select('-password -__v')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            users: users
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching users'
        });
    }
});

// GET single user (with role-based permissions)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.user;
        const userToGet = await User.findById(userId).select('-password -__v');

        if (!userToGet) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user belongs to same business
        if (userToGet.business.toString() !== currentUser.business.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Cannot view user from another business'
            });
        }

        // All authenticated users can view any user in their business
        res.json({
            success: true,
            user: userToGet
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user'
        });
    }
});

// POST create new user (with role-based permissions)
router.post('/', authenticateToken, requireUserManagementPermission, [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('role').isIn(['admin', 'cashier', 'manager']).withMessage('Invalid role'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        const currentUser = req.user;
        
        // Role-based permission for creating users
        let canCreate = false;
        
        if (currentUser.role === 'admin') {
            // Admin can create any user
            canCreate = true;
        } else if (currentUser.role === 'manager') {
            // Manager can only create cashiers
            if (req.body.role === 'cashier') {
                canCreate = true;
            }
        }
        // Cashier cannot create users

        if (!canCreate) {
            return res.status(403).json({ 
                success: false, 
                message: `You don't have permission to create ${req.body.role} users` 
            });
        }

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

        // Check if email already exists
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                errors: [{
                    field: 'email',
                    message: 'Email already registered'
                }]
            });
        }

        // Create new user (belongs to same business as current user)
        const user = new User({
            fullName: req.body.fullName,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role,
            business: currentUser.business,
            isActive: true
        });

        await user.save();

        // Return user without password
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.__v;

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating user'
        });
    }
});

// PUT update user (with role-based permissions)
router.put('/:id', authenticateToken, requireUserManagementPermission, [
    body('fullName').optional().trim().notEmpty().withMessage('Full name is required'),
    body('email').optional().isEmail().withMessage('Please enter a valid email'),
    body('role').optional().isIn(['admin', 'cashier', 'manager']).withMessage('Invalid role'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.user;
        const userToUpdate = await User.findById(userId);

        if (!userToUpdate) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user belongs to same business
        if (userToUpdate.business.toString() !== currentUser.business.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Cannot edit user from another business'
            });
        }

        // Role-based permissions
        const currentUserRole = currentUser.role;
        const targetUserRole = userToUpdate.role;

        // Permission matrix
        let canEdit = false;

        if (currentUserRole === 'admin') {
            // Admin can edit manager and cashier (but not other admins)
            if (targetUserRole === 'manager' || targetUserRole === 'cashier') {
                canEdit = true;
            } else if (targetUserRole === 'admin' && currentUser._id.toString() === userId) {
                // Admin can edit their own profile
                canEdit = true;
            }
        } else if (currentUserRole === 'manager') {
            // Manager can only edit cashier
            if (targetUserRole === 'cashier') {
                canEdit = true;
            }
        }
        // Cashier cannot edit anyone

        if (!canEdit) {
            return res.status(403).json({
                success: false,
                message: `You don't have permission to edit ${targetUserRole} users`
            });
        }

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

        // Prepare update data
        const updateData = {};
        
        if (req.body.fullName) updateData.fullName = req.body.fullName;
        
        if (req.body.email) {
            // Check if email already exists (excluding current user)
            const existingUser = await User.findOne({ 
                email: req.body.email,
                _id: { $ne: userId }
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    errors: [{
                        field: 'email',
                        message: 'Email already registered'
                    }]
                });
            }
            updateData.email = req.body.email;
        }
        
        if (req.body.role) {
            // Check if trying to demote the only admin
            if (targetUserRole === 'admin' && req.body.role !== 'admin') {
                const adminCount = await User.countDocuments({ 
                    business: currentUser.business,
                    role: 'admin',
                    _id: { $ne: userId }
                });
                if (adminCount === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot demote the only admin user. At least one admin must remain.'
                    });
                }
            }
            updateData.role = req.body.role;
        }
        
        if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
        
        // If password is provided, hash it
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(req.body.password, salt);
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password -__v');

        res.json({
            success: true,
            message: 'User updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating user'
        });
    }
});

// DELETE user (with role-based permissions)
router.delete('/:id', authenticateToken, requireUserManagementPermission, async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.user;

        // Role-based permission for deleting users
        let canDelete = false;
        
        if (currentUser.role === 'admin') {
            // Admin can delete any non-admin user
            canDelete = true;
        } else if (currentUser.role === 'manager') {
            // Manager can only delete cashiers
            const userToDelete = await User.findById(userId);
            if (userToDelete && userToDelete.role === 'cashier') {
                canDelete = true;
            }
        }
        // Cashier cannot delete anyone

        if (!canDelete) {
            return res.status(403).json({ 
                success: false, 
                message: 'You don\'t have permission to delete this user' 
            });
        }

        // Cannot delete yourself
        if (userId === currentUser._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        // Find user to delete
        const userToDelete = await User.findById(userId);
        
        if (!userToDelete) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Ensure user belongs to same business
        if (userToDelete.business.toString() !== currentUser.business.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Cannot delete user from another business'
            });
        }

        // Additional checks for admin only
        if (currentUser.role === 'admin') {
            // Cannot delete the only admin
            if (userToDelete.role === 'admin') {
                const adminUsers = await User.find({ 
                    business: currentUser.business, 
                    role: 'admin' 
                });
                
                if (adminUsers.length === 1) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot delete the only admin user. At least one admin must remain.'
                    });
                }
            }
        }

        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting user'
        });
    }
});

module.exports = router;