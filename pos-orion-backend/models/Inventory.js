const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    cost: {
      type: Number,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      min: 0,
      default: 10,
    },
    unit: {
      type: String,
      default: "pcs",
    },
    barcode: {
      type: String,
      trim: true,
    },
    supplier: {
      type: String,
      trim: true,
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastRestocked: {
      type: Date,
    },
    discountType: {
      type: String,
      enum: ["none", "percentage", "fixed"],
      default: "none",
    },
    discountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountedPrice: {
      type: Number,
      min: 0,
    },
    discountStartDate: {
      type: Date,
    },
    discountEndDate: {
      type: Date,
    },
    discountActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Generate product ID before saving
// inventorySchema.pre("save", async function (next) {
//   if (this.isNew) {
//     // Generate custom product ID: ORN-XXXXX
//     const count = await mongoose.models.Inventory.countDocuments({
//       business: this.business,
//     });
//     this.productId = `ORN-${(count + 1).toString().padStart(5, "0")}`;
//   }
//   next();
// });

// Virtual for stock status
inventorySchema.virtual("stockStatus").get(function () {
  if (this.category === "services") return "service";
  if (this.quantity <= 0) return "out_of_stock";
  if (this.quantity <= this.lowStockThreshold) return "low_stock";
  if (this.quantity <= this.lowStockThreshold * 3) return "medium_stock";
  return "in_stock";
});

// Method to update stock
inventorySchema.methods.updateStock = async function (
  quantityChange,
  isRestock = false
) {
  const newQuantity = this.quantity + quantityChange;

  if (newQuantity < 0) {
    throw new Error("Insufficient stock");
  }

  this.quantity = newQuantity;

  if (isRestock) {
    this.lastRestocked = new Date();
  }

  return this.save();
};


// Add a method to calculate discounted price
inventorySchema.methods.getDiscountedPrice = function () {
  if (!this.discountActive || this.discountType === "none") {
    return this.price;
  }

  if (this.discountType === "percentage") {
    const discountAmount = (this.price * this.discountValue) / 100;
    return Math.max(0, this.price - discountAmount);
  }

  if (this.discountType === "fixed") {
    return Math.max(0, this.price - this.discountValue);
  }

  return this.price;
};

// Add a pre-save hook to update discountedPrice
inventorySchema.pre("save", function (next) {
  if (this.discountType === "none" || !this.discountActive) {
    this.discountedPrice = this.price;
  } else {
    this.discountedPrice = this.getDiscountedPrice();
  }

  // Validate discount dates
  if (this.discountStartDate && this.discountEndDate) {
    if (this.discountEndDate < this.discountStartDate) {
      return next(new Error("Discount end date must be after start date"));
    }
    
    // Auto-activate discount if dates are valid
    const now = new Date();
    if (this.discountStartDate <= now && this.discountEndDate >= now) {
      this.discountActive = true;
    } else {
      this.discountActive = false;
    }
  }

  next();
});

// Add a virtual field for discount info
inventorySchema.virtual("discountInfo").get(function () {
  if (!this.discountActive || this.discountType === "none") {
    return null;
  }

  return {
    type: this.discountType,
    value: this.discountValue,
    discountedPrice: this.discountedPrice,
    originalPrice: this.price,
    discountAmount: this.price - this.discountedPrice,
    startDate: this.discountStartDate,
    endDate: this.discountEndDate,
    active: this.discountActive,
  };
});

// Add a method to check if discount is currently active
inventorySchema.methods.isDiscountActive = function () {
  if (!this.discountActive) return false;
  
  if (this.discountStartDate && this.discountEndDate) {
    const now = new Date();
    return now >= this.discountStartDate && now <= this.discountEndDate;
  }
  
  return this.discountActive;
};

module.exports = mongoose.model("Inventory", inventorySchema);
