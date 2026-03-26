const mongoose = require("mongoose");

const transactionItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Inventory",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
});

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [transactionItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountsApplied: [
      {
        discountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Discount",
        },
        discountName: String,
        discountType: {
          type: String,
          enum: ["percentage", "fixed", "bogo"],
        },
        discountValue: Number,
        discountAmount: Number,
        appliedToItems: [
          {
            productId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Inventory",
            },
            name: String,
            quantity: Number,
            discountPerItem: Number,
          },
        ],
      },
    ],
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "wallet", "credit", "other", "refund"],
      default: "cash",
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    change: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["completed", "pending", "cancelled", "refunded", "partial_refund"],
      default: "completed",
    },
    notes: {
      type: String,
      trim: true,
    },
    customer: {
      name: String,
      email: String,
      phone: String,
    },
    taxInclusive: {
      type: Boolean,
      default: true,
    },
    taxRate: {
      type: Number,
      default: 8,
    },
    taxName: {
      type: String,
      default: "Sales Tax",
    },
    originalTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    refundTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    refundReason: {
      type: String,
      trim: true,
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    refundedAt: {
      type: Date,
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    isRefund: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Generate transaction ID
transactionSchema.pre("save", async function (next) {
  if (this.isNew && !this.transactionId) {
    try {
      const date = new Date();
      const year = date.getFullYear().toString(); // Last 2 digits
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");

      // Format: YY-DD-MM (25-12-24 for Dec 24, 2025)
      const datePrefix = `${year}${day}${month}`;

      let todayCount = 0;

      if (this.business) {
        // Count today's transactions for this business
        const todayStart = new Date(date);
        todayStart.setHours(0, 0, 0, 0);
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);

        todayCount = await mongoose.models.Transaction.countDocuments({
          business: this.business,
          createdAt: { $gte: todayStart, $lt: tomorrow },
        });
      } else {
        // Count all today's transactions
        const todayStart = new Date(date);
        todayStart.setHours(0, 0, 0, 0);
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);

        todayCount = await mongoose.models.Transaction.countDocuments({
          createdAt: { $gte: todayStart, $lt: tomorrow },
        });
      }

      // Generate transactionId: 25-12-24-0001 (YY-DD-MM-SSSS)
      const prefix = this.isRefund ? "REF" : "TXN";
      this.transactionId = `${prefix}-${datePrefix}-${(todayCount + 1)
        .toString()
        .padStart(4, "0")}`;

      console.log(
        `Generated transactionId: ${this.transactionId} (count: ${todayCount})`,
      );
    } catch (error) {
      console.error("Error generating transaction ID:", error);
      // Fallback to timestamp
      this.transactionId = `TXN-${Date.now()}`;
    }
  }
  next();
});

module.exports = mongoose.model("Transaction", transactionSchema);
