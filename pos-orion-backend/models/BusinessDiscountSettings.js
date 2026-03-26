const mongoose = require('mongoose');

const businessDiscountSettingsSchema = new mongoose.Schema({
    business: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        unique: true
    },
    
    // General settings
    presets: [{
        type: Number,
        min: 0,
        max: 100
    }],
    allowedTypes: [{
        type: String,
        enum: ['percentage', 'fixed', 'bogo', 'bulk']
    }],
    defaults: {
        taxBeforeDiscount: {
            type: Boolean,
            default: true
        },
        rounding: {
            type: Boolean,
            default: true
        }
    },
    
    // Application order
    applicationOrder: [{
        type: String,
        enum: ['product', 'category', 'customer', 'order']
    }],
    priority: {
        type: String,
        enum: ['cumulative', 'highest', 'lowest', 'order'],
        default: 'cumulative'
    },
    
    // Stacking rules
    stacking: {
        multiple: {
            type: Boolean,
            default: false
        },
        couponProduct: {
            type: Boolean,
            default: false
        },
        loyaltyWithAll: {
            type: Boolean,
            default: true
        }
    },
    
    // Coupon settings
    coupons: {
        enabled: {
            type: Boolean,
            default: true
        },
        autoValidate: {
            type: Boolean,
            default: true
        },
        onePerOrder: {
            type: Boolean,
            default: false
        }
    },
    
    // Time-based discounts
    timeBased: {
        happyHour: {
            type: Boolean,
            default: false
        },
        earlyBird: {
            type: Boolean,
            default: false
        }
    },
    
    // Loyalty program
    loyalty: {
        autoApply: {
            type: Boolean,
            default: true
        },
        pointsPerDollar: {
            type: Number,
            default: 1
        },
        discountPerPoint: {
            type: Number,
            default: 0.01
        }
    },
    
    // Day-specific discounts
    days: {
        monday: { type: Boolean, default: false },
        tuesday: { type: Boolean, default: false },
        wednesday: { type: Boolean, default: false },
        thursday: { type: Boolean, default: false },
        friday: { type: Boolean, default: false },
        saturday: { type: Boolean, default: false },
        sunday: { type: Boolean, default: false }
    },
    
    // Limits and restrictions
    limits: {
        requireManagerApproval: {
            type: Boolean,
            default: true
        },
        managerThreshold: {
            type: Number,
            default: 25,
            min: 0,
            max: 100
        },
        maxDiscountEnabled: {
            type: Boolean,
            default: false
        },
        maxDiscountPercent: {
            type: Number,
            default: 50,
            min: 0,
            max: 100
        },
        cashierLimitEnabled: {
            type: Boolean,
            default: false
        },
        cashierMaxPercent: {
            type: Number,
            default: 15,
            min: 0,
            max: 100
        },
        minPurchaseEnabled: {
            type: Boolean,
            default: false
        },
        minPurchaseAmount: {
            type: Number,
            default: 10,
            min: 0
        }
    },
    
    // Metadata
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Create default settings when business is created
businessDiscountSettingsSchema.statics.createDefaultSettings = async function(businessId) {
    const defaultSettings = {
        business: businessId,
        presets: [5, 10, 15, 20, 25],
        allowedTypes: ['percentage', 'fixed'],
        defaults: {
            taxBeforeDiscount: true,
            rounding: true
        },
        applicationOrder: ['product', 'customer', 'order'],
        priority: 'cumulative',
        stacking: {
            multiple: false,
            couponProduct: false,
            loyaltyWithAll: true
        },
        coupons: {
            enabled: true,
            autoValidate: true,
            onePerOrder: false
        },
        timeBased: {
            happyHour: false,
            earlyBird: false
        },
        loyalty: {
            autoApply: true,
            pointsPerDollar: 1,
            discountPerPoint: 0.01
        },
        days: {
            monday: false,
            tuesday: false,
            wednesday: false,
            thursday: false,
            friday: false,
            saturday: false,
            sunday: false
        },
        limits: {
            requireManagerApproval: true,
            managerThreshold: 25,
            maxDiscountEnabled: false,
            maxDiscountPercent: 50,
            cashierLimitEnabled: false,
            cashierMaxPercent: 15,
            minPurchaseEnabled: false,
            minPurchaseAmount: 10
        }
    };
    
    return this.create(defaultSettings);
};

module.exports = mongoose.model('BusinessDiscountSettings', businessDiscountSettingsSchema);