const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['retail', 'restaurant', 'service', 'ecommerce', 'wholesale', 'salon', 'grocery', 'other'],
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    taxSettings: {
        enabled: {
            type: Boolean,
            default: true
        },
        rate: {
            type: Number,
            default: 8.0
        },
        taxName: {
            type: String,
            default: 'Sales Tax'
        },
         taxInclusive: {
            type: Boolean,
            default: true  // Prices include tax by default
        },
        registeredTaxId: {
            type: String,
            default: '1234567890' // Default tax ID, can be updated by the user
        }
    
    },
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'basic', 'pro', 'enterprise'],
            default: 'free'
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled'],
            default: 'active'
        },
        expiryDate: {
            type: Date,
            default: () => new Date(+new Date() + 30*24*60*60*1000) // 30 days from now
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Add this to your existing businessSchema
businessSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            // Create default discount settings
            const BusinessDiscountSettings = require('./BusinessDiscountSettings');
            await BusinessDiscountSettings.createDefaultSettings(this._id);
            
            // Create default permissions
            const Permission = require('./Permission');
            const permission = new Permission({
                business: this._id,
                roles: Permission.getDefaultPermissions(),
                createdBy: this.owner
            });
            await permission.save();
            
            console.log('Default permissions created for business:', this._id);
        } catch (error) {
            console.error('Error creating default settings:', error);
        }
    }
    next();
});

module.exports = mongoose.model('Business', businessSchema);