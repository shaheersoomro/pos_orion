const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

// GET all users for the business (only admin can access)
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only admins can view users' 
            });
        }

        // Find all users for the same business
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

// POST create new user (admin only)
router.post('/', authenticateToken, [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('role').isIn(['admin', 'cashier', 'manager']).withMessage('Invalid role'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only admins can create users' 
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

        // Create new user (belongs to same business as admin)
        const user = new User({
            fullName: req.body.fullName,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role,
            business: req.user.business, // Same business as admin
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

// DELETE user (admin only, cannot delete self)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only admins can delete users' 
            });
        }

        const userId = req.params.id;

        // Cannot delete yourself
        if (userId === req.user._id.toString()) {
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
        if (userToDelete.business.toString() !== req.user.business.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Cannot delete user from another business'
            });
        }

        // Cannot delete the original admin (business owner)
        if (userToDelete.role === 'admin') {
            // Get all admin users in the business
            const adminUsers = await User.find({ 
                business: req.user.business, 
                role: 'admin' 
            });
            
            // If this is the only admin, cannot delete
            if (adminUsers.length === 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete the only admin user. At least one admin must remain.'
                });
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