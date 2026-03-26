const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    business: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed', 'bogo', 'bulk'],
        required: true
    },
    value: {
        type: Number,
        required: function() { 
            return this.type === 'percentage' || this.type === 'fixed';
        },
        min: 0
    },
    valueType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: function() {
            return this.type === 'percentage' || this.type === 'fixed';
        }
    },
    
    // BOGO specific fields
    bogo: {
        buyQuantity: Number,
        getQuantity: Number,
        buyProducts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Inventory'
        }],
        getProducts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Inventory'
        }],
        sameProduct: Boolean,
        repeatable: Boolean
    },
    
    // Bulk discount specific fields
    bulk: {
        minQuantity: Number,
        discountPerItem: Number,
        products: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Inventory'
        }]
    },
    
    // Application scope
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory'
    }],
    applyToAll: {
        type: Boolean,
        default: false
    },
    
    // Conditions
    conditions: {
        minAmount: {
            amount: Number,
            operator: {
                type: String,
                enum: ['>', '>=', '=', '<', '<=']
            }
        },
        timeRange: {
            start: String, // HH:mm format
            end: String,   // HH:mm format
            enabled: Boolean
        },
        days: [{
            type: String,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }]
    },
    
    // Validity
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date
    },
    
    // Additional options
    autoApply: {
        type: Boolean,
        default: false
    },
    cumulative: {
        type: Boolean,
        default: false
    },
    onePerCustomer: {
        type: Boolean,
        default: false
    },
    maxUses: Number,
    usedCount: {
        type: Number,
        default: 0
    },
    
    // Status
    status: {
        type: String,
        enum: ['active', 'inactive', 'expired'],
        default: 'active'
    },
    
    // Settings
    priority: {
        type: Number,
        default: 0
    },
    
    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Add index for faster queries
discountSchema.index({ business: 1, status: 1, validFrom: 1, validUntil: 1 });
discountSchema.index({ business: 1, type: 1 });
discountSchema.index({ 'bogo.products': 1 });

// Method to check if discount is currently valid
discountSchema.methods.isValid = function() {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Check status
    if (this.status !== 'active') return false;
    
    // Check date validity
    if (this.validFrom && now < this.validFrom) return false;
    if (this.validUntil && now > this.validUntil) return false;
    
    // Check day restrictions
    if (this.conditions.days && this.conditions.days.length > 0) {
        if (!this.conditions.days.includes(currentDay)) return false;
    }
    
    // Check time restrictions
    if (this.conditions.timeRange && this.conditions.timeRange.enabled) {
        if (currentTime < this.conditions.timeRange.start || 
            currentTime > this.conditions.timeRange.end) {
            return false;
        }
    }
    
    // Check usage limits
    if (this.maxUses && this.usedCount >= this.maxUses) return false;
    
    return true;
};

// Method to apply discount to an order
// Method to apply discount to an order
discountSchema.methods.calculateDiscount = function(orderItems, orderTotal) {
    if (!this.isValid()) return { discountAmount: 0, applicableItems: [] };
    
    // Check minimum amount condition
    if (this.conditions && this.conditions.minAmount) {
        const minAmount = this.conditions.minAmount.amount;
        const operator = this.conditions.minAmount.operator;
        
        let conditionMet = false;
        switch(operator) {
            case '>': conditionMet = orderTotal > minAmount; break;
            case '>=': conditionMet = orderTotal >= minAmount; break;
            case '=': conditionMet = orderTotal === minAmount; break;
            case '<': conditionMet = orderTotal < minAmount; break;
            case '<=': conditionMet = orderTotal <= minAmount; break;
            default: conditionMet = true;
        }
        
        if (!conditionMet) return { discountAmount: 0, applicableItems: [] };
    }
    
    // Filter applicable items based on discount scope
    let applicableItems = [];
    
    if (this.applyToAll) {
        applicableItems = orderItems;
    } else if (this.products && this.products.length > 0) {
        // Handle both product objects and product IDs
        applicableItems = orderItems.filter(item => {
            const productId = item.productId || item.product?._id || item.product;
            return this.products.some(discountProduct => 
                discountProduct._id && discountProduct._id.toString() === productId.toString() ||
                discountProduct.toString() === productId.toString()
            );
        });
    } else if (this.categories && this.categories.length > 0) {
        // Handle categories - this would require items to have category info
        // For now, skip category filtering if items don't have category data
        applicableItems = orderItems;
    }
    
    if (applicableItems.length === 0 && !this.applyToAll) {
        return { discountAmount: 0, applicableItems: [] };
    }
    
    let discountAmount = 0;
    
    switch(this.type) {
        case 'percentage':
            const subtotal = applicableItems.reduce((sum, item) => 
                sum + (item.quantity * (item.unitPrice || item.price)), 0);
            discountAmount = (subtotal * this.value) / 100;
            break;
            
        case 'fixed':
            discountAmount = this.value;
            break;
            
        case 'bogo':
            // Calculate BOGO discount
            if (this.bogo && this.bogo.buyProducts) {
                const buyProducts = this.bogo.buyProducts;
                const getProducts = this.bogo.getProducts || buyProducts;
                
                // Group items by product
                const buyItems = applicableItems.filter(item => {
                    const productId = item.productId || item.product?._id || item.product;
                    return buyProducts.some(buyProduct => 
                        buyProduct._id && buyProduct._id.toString() === productId.toString() ||
                        buyProduct.toString() === productId.toString()
                    );
                });
                
                // Calculate eligible sets
                let totalBuyQuantity = buyItems.reduce((sum, item) => sum + item.quantity, 0);
                let sets = Math.floor(totalBuyQuantity / this.bogo.buyQuantity);
                
                if (sets > 0) {
                    // Calculate value of free items
                    const freeItemsValue = getProducts.reduce((total, productId) => {
                        const productObj = typeof productId === 'object' ? productId : { _id: productId };
                        const product = orderItems.find(item => {
                            const itemProductId = item.productId || item.product?._id || item.product;
                            return itemProductId.toString() === productObj._id.toString();
                        });
                        if (product) {
                            const freeQty = Math.min(product.quantity, sets * this.bogo.getQuantity);
                            return total + (freeQty * (product.unitPrice || product.price));
                        }
                        return total;
                    }, 0);
                    
                    discountAmount = freeItemsValue;
                }
            }
            break;
    }
    
    // Cap discount at order total
    discountAmount = Math.min(discountAmount, orderTotal);
    
    return {
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        applicableItems,
        discountType: this.type,
        discountName: this.name
    };
};

// Pre-save hook to update status based on validity
discountSchema.pre('save', function(next) {
    const now = new Date();
    
    // Update status based on dates
    if (this.validUntil && now > this.validUntil && this.status === 'active') {
        this.status = 'expired';
    }
    
    // Update status based on usage limits
    if (this.maxUses && this.usedCount >= this.maxUses && this.status === 'active') {
        this.status = 'inactive';
    }
    
    next();
});

module.exports = mongoose.model('Discount', discountSchema);