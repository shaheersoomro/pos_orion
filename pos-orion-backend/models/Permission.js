const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    business: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        unique: true
    },
    roles: {
        admin: {
            canManageUsers: { type: Boolean, default: true },
            canManageDiscounts: { type: Boolean, default: true },
            canManageInventory: { type: Boolean, default: true },
            canManageSettings: { type: Boolean, default: true },
            canViewReports: { type: Boolean, default: true },
            canProcessRefunds: { type: Boolean, default: true },
            canCreateSales: { type: Boolean, default: true }
        },
        manager: {
            canManageUsers: { type: Boolean, default: true },
            canManageDiscounts: { type: Boolean, default: true },
            canManageInventory: { type: Boolean, default: true },
            canManageSettings: { type: Boolean, default: false },
            canViewReports: { type: Boolean, default: true },
            canProcessRefunds: { type: Boolean, default: true },
            canCreateSales: { type: Boolean, default: true }
        },
        cashier: {
            canManageUsers: { type: Boolean, default: false },
            canManageDiscounts: { type: Boolean, default: false },
            canManageInventory: { type: Boolean, default: false },
            canManageSettings: { type: Boolean, default: false },
            canViewReports: { type: Boolean, default: false },
            canProcessRefunds: { type: Boolean, default: false },
            canCreateSales: { type: Boolean, default: true }
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Method to check if user has permission
permissionSchema.methods.hasPermission = function(userRole, permission) {
    const rolePermissions = this.roles[userRole];
    if (!rolePermissions) return false;
    return rolePermissions[permission] || false;
};


// Static method to get default permissions
permissionSchema.statics.getDefaultPermissions = function() {
    return {
        admin: {
            canManageUsers: true,
            canManageDiscounts: true,
            canManageInventory: true,
            canManageSettings: true,
            canViewReports: true,
            canProcessRefunds: true,
            canCreateSales: true
        },
        manager: {
            canManageUsers: true,
            canManageDiscounts: true,
            canManageInventory: true,
            canManageSettings: false,
            canViewReports: true,
            canProcessRefunds: true,
            canCreateSales: true
        },
        cashier: {
            canManageUsers: false,
            canManageDiscounts: false,
            canManageInventory: false,
            canManageSettings: false,
            canViewReports: false,
            canProcessRefunds: false,
            canCreateSales: true
        }
    };
};

module.exports = mongoose.model('Permission', permissionSchema);