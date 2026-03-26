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
        // Create default discount settings when business is created
        try {
            const BusinessDiscountSettings = require('./BusinessDiscountSettings');
            await BusinessDiscountSettings.createDefaultSettings(this._id);
        } catch (error) {
            console.error('Error creating default discount settings:', error);
        }
    }
    next();
});

module.exports = mongoose.model('Business', businessSchema);