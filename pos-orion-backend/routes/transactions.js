const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Transaction = require("../models/Transaction");
const Inventory = require("../models/Inventory");
const User = require("../models/User");

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error("JWT verification error:", err.message);
      return res
        .status(403)
        .json({ success: false, message: "Invalid or expired token" });
    }

    try {
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("User lookup error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during authentication",
      });
    }
  });
};

// Test endpoint
router.get("/test", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Transactions API is working",
    user: {
      id: req.user._id,
      name: req.user.fullName,
      business: req.user.business,
      role: req.user.role,
    },
  });
});

// POST create new transaction
router.post(
  "/",
  authenticateToken,
  [
    body("items")
      .isArray({ min: 1 })
      .withMessage("At least one item is required"),
    body("items.*.productId")
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage("Invalid product ID"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),
    body("paymentMethod")
      .isIn(["cash", "card", "wallet", "credit", "other", "refund"])
      .withMessage("Invalid payment method"),
    body("amountPaid")
      .isFloat({ min: 0 })
      .withMessage("Amount paid must be a positive number"),
    body("appliedDiscounts")
      .optional()
      .isArray()
      .withMessage("Applied discounts must be an array"),
  ],
  async (req, res) => {
    try {
      console.log("=== TRANSACTION REQUEST ===");
      console.log("User ID:", req.user._id);
      console.log("User Business:", req.user.business);
      console.log("Request Body:", JSON.stringify(req.body, null, 2));

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
          })),
        });
      }

      const {
        items,
        paymentMethod = "cash",
        amountPaid,
        customer,
        notes,
        taxRate = 8,
        taxName = "Sales Tax",
        taxInclusive = true,
        appliedDiscounts = [],
        discount = 0, // Legacy discount field for backward compatibility
        // IMPORTANT: Accept these values from frontend
        subtotal: frontendSubtotal,
        tax: frontendTax,
        total: frontendTotal,
      } = req.body;

      // Get user's business
      const userBusiness = req.user.business;

      if (!userBusiness) {
        return res.status(400).json({
          success: false,
          message: "User is not associated with any business",
        });
      }

      // Validate inventory items and check stock
      const validatedItems = [];
      let calculatedSubtotal = 0;

      for (const item of items) {
        try {
          // Find the inventory item
          const inventoryItem = await Inventory.findOne({
            _id: item.productId,
            business: userBusiness,
          });

          if (!inventoryItem) {
            return res.status(404).json({
              success: false,
              message: `Product not found: ${item.productId}`,
            });
          }

          console.log(
            `Found product: ${inventoryItem.name}, Stock: ${inventoryItem.quantity}, Requested: ${item.quantity}`,
          );

          // Check stock for non-service items
          const isService = inventoryItem.category === "services";

          if (!isService && inventoryItem.quantity < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}`,
            });
          }

          // Calculate item subtotal using the price from inventory
          const itemSubtotal = inventoryItem.price * item.quantity;

          validatedItems.push({
            productId: inventoryItem._id,
            name: inventoryItem.name,
            quantity: item.quantity,
            price: inventoryItem.price,
            subtotal: itemSubtotal,
          });

          calculatedSubtotal += itemSubtotal;
        } catch (itemError) {
          console.error(`Error processing item ${item.productId}:`, itemError);
          return res.status(400).json({
            success: false,
            message: `Error processing item: ${itemError.message}`,
          });
        }
      }

      // Calculate discount
      let totalDiscount = 0;
      let discountsApplied = [];

      // Handle legacy discount field (for backward compatibility)
      // if (discount && discount > 0) {
      //   totalDiscount = discount;
      //   discountsApplied.push({
      //     discountName: "Manual Discount",
      //     discountType: "fixed",
      //     discountValue: discount,
      //     originalAmount: calculatedSubtotal,
      //     discountedAmount: discount,
      //   });
      // }

      // Handle applied discounts (new system)
      if (appliedDiscounts && appliedDiscounts.length > 0) {
        // Validate and apply provided discounts
        for (const discountData of appliedDiscounts) {
          try {
            // You need to import Discount model at the top
            const Discount = require("../models/Discount");
            
            const discount = await Discount.findOne({
              _id: discountData.discountId,
              business: userBusiness,
              status: "active",
            });

            if (!discount) {
              return res.status(400).json({
                success: false,
                message: `Discount not found or not active: ${discountData.discountId}`,
              });
            }

            // Verify discount is valid
            if (!discount.isValid()) {
              return res.status(400).json({
                success: false,
                message: `Discount "${discount.name}" is not currently valid`,
              });
            }

            // Calculate discount for this transaction
            const discountResult = discount.calculateDiscount(
              validatedItems,
              calculatedSubtotal,
            );

            if (discountResult.discountAmount > 0) {
              totalDiscount += discountResult.discountAmount;

              discountsApplied.push({
                // discountId: discount._id,
                discountName: discount.name,
                discountType: discount.type,
                discountValue: discount.value || discountResult.discountAmount,
                originalAmount: discountResult.applicableItems.reduce(
                  (sum, item) => sum + item.quantity * item.price,
                  0,
                ),
                discountedAmount: discountResult.discountAmount,
                discountDetails: discountResult,
              });
            }
          } catch (discountError) {
            console.error("Error processing discount:", discountError);
            // Continue with transaction even if discount fails
          }
        }
      }

      // Apply discount to subtotal
      const discountedSubtotal = Math.max(0, calculatedSubtotal - totalDiscount);

      // IMPORTANT FIX: Use frontend values if provided, otherwise calculate
      let finalSubtotal, finalTax, finalTotal;

      if (frontendSubtotal !== undefined && frontendTax !== undefined && frontendTotal !== undefined) {
        // Use the values from frontend (trust frontend calculation)
        finalSubtotal = frontendSubtotal;
        finalTax = frontendTax;
        finalTotal = frontendTotal;
        
        console.log("Using frontend calculated values:", {
          subtotal: finalSubtotal,
          tax: finalTax,
          total: finalTotal
        });
      } else {
        // Calculate based on tax settings (fallback)
        if (taxInclusive) {
          // Tax-inclusive pricing
          finalTax = discountedSubtotal * (taxRate / (100 + taxRate));
          finalSubtotal = discountedSubtotal - finalTax;
          finalTotal = discountedSubtotal;
        } else {
          // Tax-exclusive pricing
          finalTax = discountedSubtotal * (taxRate / 100);
          finalSubtotal = discountedSubtotal;
          finalTotal = discountedSubtotal + finalTax;
        }
      }

      // Validate payment amount against final total
      if (amountPaid < finalTotal) {
        return res.status(400).json({
          success: false,
          message: `Insufficient payment. Total: $${finalTotal.toFixed(
            2,
          )}, Paid: $${amountPaid.toFixed(2)}`,
        });
      }

      const change = amountPaid - finalTotal;

      // Create the transaction
      const transactionData = {
        business: userBusiness,
        cashier: req.user._id,
        items: validatedItems,
        subtotal: parseFloat(finalSubtotal.toFixed(2)),
        tax: parseFloat(finalTax.toFixed(2)),
        discount: parseFloat(totalDiscount.toFixed(2)),
        total: parseFloat(finalTotal.toFixed(2)),
        paymentMethod: paymentMethod,
        amountPaid: parseFloat(amountPaid.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        status: "completed",
        notes: notes || `POS transaction - ${new Date().toLocaleString()}`,
        customer: customer || { name: "Walk-in Customer" },
        taxRate: taxRate,
        taxName: taxName,
        taxInclusive: taxInclusive,
        discountsApplied: discountsApplied,
      };

      console.log("Transaction data to save:", transactionData);

      const transaction = new Transaction(transactionData);
      await transaction.save();

      console.log("Transaction saved successfully:", transaction._id);

      // Update inventory quantities
      for (const item of validatedItems) {
        try {
          const inventoryItem = await Inventory.findOne({
            _id: item.productId,
            business: userBusiness,
          });

          if (inventoryItem) {
            const previousQuantity = inventoryItem.quantity;
            inventoryItem.quantity = previousQuantity - item.quantity;
            await inventoryItem.save();
            console.log(
              `Updated inventory for ${item.name}: ${previousQuantity} -> ${inventoryItem.quantity}`,
            );
          }
        } catch (inventoryError) {
          console.error(
            `Error updating inventory for product ${item.productId}:`,
            inventoryError,
          );
          // Log but don't fail the transaction
        }
      }

      // Update discount usage counts
      for (const discountData of discountsApplied) {
        if (discountData.discountId) {
          try {
            const Discount = require("../models/Discount");
            await Discount.findByIdAndUpdate(discountData.discountId, {
              $inc: { usedCount: 1 },
            });
          } catch (discountError) {
            console.error(`Error updating discount usage:`, discountError);
          }
        }
      }

      res.status(201).json({
        success: true,
        message: "Transaction completed successfully",
        transaction: {
          _id: transaction._id,
          transactionId: transaction.transactionId,
          total: transaction.total,
          discount: transaction.discount,
          items: transaction.items,
          discountsApplied: transaction.discountsApplied,
          createdAt: transaction.createdAt,
          change: transaction.change,
        },
      });
    } catch (error) {
      console.error("=== TRANSACTION ERROR ===");
      console.error("Error:", error);
      console.error("Stack:", error.stack);

      res.status(500).json({
        success: false,
        message: "Server error while processing transaction",
        error: error.message,
        // Only show stack in development
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      });
    }
  },
);

// GET all transactions
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { business: req.user.business };
    const transactions = await Transaction.find(query)
      .populate("cashier", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transactions",
    });
  }
});

router.get("/summary/today", authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pipeline = [
      {
        $match: {
          business: req.user.business,
          status: "completed",
          createdAt: {
            $gte: today,
            $lt: tomorrow,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          transactionCount: { $sum: 1 },
        },
      },
    ];

    const result = await Transaction.aggregate(pipeline);

    // Handle no results case
    let summary;
    if (result.length > 0) {
      summary = {
        totalSales: result[0].totalSales || 0,
        transactionCount: result[0].transactionCount || 0,
      };
    } else {
      summary = {
        totalSales: 0,
        transactionCount: 0,
      };
    }

    res.json({
      success: true,
      summary: {
        totalSales: summary.totalSales.toFixed(2), // Keep as string for display
        transactionCount: summary.transactionCount,
        formattedTotal: `$${summary.totalSales.toFixed(2)}`, // Already formatted
      },
    });
  } catch (error) {
    console.error("Error fetching today summary:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching today summary",
      summary: {
        totalSales: "0.00",
        transactionCount: 0,
      },
    });
  }
});

// GET next order number
router.get("/next-order-number", authenticateToken, async (req, res) => {
  try {
    const today = new Date();

    // Format: YY-DD-MM (25-12-22 for Dec 22, 2025)
    const year = today.getFullYear().toString().slice(-2); // Last 2 digits
    const day = today.getDate().toString().padStart(2, "0");
    const month = (today.getMonth() + 1).toString().padStart(2, "0");

    const datePrefix = `${year}-${day}-${month}`; // 25-12-22

    // Start of today (00:00:00)
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    // Start of tomorrow (00:00:00)
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count today's completed transactions
    const todayCount = await Transaction.countDocuments({
      business: req.user.business,
      status: "completed",
      createdAt: { $gte: todayStart, $lt: tomorrow },
    });

    // Next sequence number (1-based, 4 digits)
    const nextSequence = todayCount + 1;

    // Format: YY-DD-MM-SSSS (25-12-22-0123)
    const nextOrderNumber = `${datePrefix}-${nextSequence.toString().padStart(4, "0")}`;

    // For high-volume businesses (over 9999 orders/day)
    if (nextSequence > 9999) {
      // Use 5 digits
      const extendedSequence = nextSequence.toString().padStart(5, "0");
      const extendedOrderNumber = `${datePrefix}-${extendedSequence}`;

      res.json({
        success: true,
        nextOrderNumber: extendedOrderNumber,
        displayNumber: nextSequence.toString().padStart(5, "0"),
        datePrefix,
        sequence: nextSequence,
        warning: "Exceeded 9999 daily orders",
      });
    } else {
      res.json({
        success: true,
        nextOrderNumber,
        displayNumber: nextSequence.toString().padStart(4, "0"),
        datePrefix,
        sequence: nextSequence,
      });
    }
  } catch (error) {
    console.error("Error getting next order number:", error);
    // Fallback: Today's date with 0001
    const fallbackDate = new Date();
    const fallbackYear = fallbackDate.getFullYear().toString().slice(-2);
    const fallbackDay = fallbackDate.getDate().toString().padStart(2, "0");
    const fallbackMonth = (fallbackDate.getMonth() + 1)
      .toString()
      .padStart(2, "0");
    const fallbackNumber = `${fallbackYear}-${fallbackDay}-${fallbackMonth}-0001`;

    res.status(500).json({
      success: false,
      message: "Server error getting order number",
      nextOrderNumber: fallbackNumber,
      displayNumber: "0001",
    });
  }
});

// GET single transaction
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      business: req.user.business,
    })
      .populate("cashier", "fullName email")
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transaction",
    });
  }
});

// POST refund transaction
router.post("/:id/refund", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { refundItems, reason, partialRefund = false } = req.body;

    // Find the transaction
    const transaction = await Transaction.findOne({
      _id: id,
      business: req.user.business,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Check if transaction is already refunded
    if (transaction.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Transaction already refunded",
      });
    }

    // Check if transaction is cancelled
    if (transaction.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot refund a cancelled transaction",
      });
    }

    let refundAmount = 0;
    const itemsToRefund = [];
    const inventoryUpdates = [];

    if (partialRefund && refundItems && refundItems.length > 0) {
      // Partial refund - specific items
      for (const refundItem of refundItems) {
        const originalItem = transaction.items.find(
          (item) => item.productId.toString() === refundItem.productId,
        );

        if (!originalItem) {
          return res.status(400).json({
            success: false,
            message: `Item not found in transaction: ${refundItem.productId}`,
          });
        }

        if (refundItem.quantity > originalItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `Refund quantity (${refundItem.quantity}) exceeds original quantity (${originalItem.quantity}) for ${originalItem.name}`,
          });
        }

        const itemRefundAmount = originalItem.price * refundItem.quantity;
        refundAmount += itemRefundAmount;

        itemsToRefund.push({
          ...originalItem.toObject(),
          refundQuantity: refundItem.quantity,
          refundAmount: itemRefundAmount,
        });

        // Track inventory updates
        inventoryUpdates.push({
          productId: originalItem.productId,
          quantity: refundItem.quantity,
          name: originalItem.name,
        });
      }
    } else {
      // Full refund - all items
      refundAmount = transaction.total;

      transaction.items.forEach((item) => {
        itemsToRefund.push({
          ...item.toObject(),
          refundQuantity: item.quantity,
          refundAmount: item.subtotal,
        });

        inventoryUpdates.push({
          productId: item.productId,
          quantity: item.quantity,
          name: item.name,
        });
      });
    }

    // Create refund record
    const refundTransaction = new Transaction({
      business: transaction.business,
      cashier: req.user._id,
      items: itemsToRefund.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.refundQuantity,
        price: item.price,
        subtotal: item.refundAmount,
      })),
      subtotal: refundAmount,
      tax: 0, // Refunds typically don't include tax
      discount: 0,
      total: refundAmount,
      paymentMethod: "refund",
      amountPaid: 0,
      change: 0,
      status: "refunded",
      notes: `Refund for transaction ${transaction.transactionId}${reason ? `: ${reason}` : ""}`,
      customer: transaction.customer,
      originalTransaction: transaction._id,
      refundReason: reason,
      isRefund: true,
    });

    await refundTransaction.save();

    // Update original transaction status
    if (partialRefund) {
      transaction.status = "partially_refunded";
      transaction.refundedAmount =
        (transaction.refundedAmount || 0) + refundAmount;
    } else {
      transaction.status = "refunded";
    }

    transaction.refundReason = reason;
    transaction.refundedBy = req.user._id;
    transaction.refundedAt = new Date();
    transaction.refundTransaction = refundTransaction._id;

    await transaction.save();

    // Update inventory for non-service items
    for (const update of inventoryUpdates) {
      try {
        const inventoryItem = await Inventory.findOne({
          _id: update.productId,
          business: req.user.business,
        });

        if (inventoryItem && inventoryItem.category !== "services") {
          const previousQuantity = inventoryItem.quantity;
          inventoryItem.quantity = previousQuantity + update.quantity;
          await inventoryItem.save();

          console.log(
            `Updated inventory for ${update.name}: ${previousQuantity} -> ${inventoryItem.quantity} (refund)`,
          );
        }
      } catch (inventoryError) {
        console.error(
          `Error updating inventory for product ${update.productId}:`,
          inventoryError,
        );
        // Continue with other updates
      }
    }

    res.json({
      success: true,
      message: `Transaction ${partialRefund ? "partially " : ""}refunded successfully`,
      refund: {
        refundId: refundTransaction._id,
        refundTransactionId: refundTransaction.transactionId,
        refundAmount: refundAmount,
        originalTransactionId: transaction.transactionId,
        partialRefund: partialRefund,
      },
    });
  } catch (error) {
    console.error("Refund error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing refund",
      error: error.message,
    });
  }
});

// GET refund reasons (common reasons)
router.get("/refund/reasons", authenticateToken, (req, res) => {
  const reasons = [
    "Customer changed mind",
    "Defective product",
    "Wrong item received",
    "Price mismatch",
    "Duplicate transaction",
    "Customer dissatisfaction",
    "Cancelled order",
    "Returned item",
    "Other (specify in notes)",
  ];

  res.json({
    success: true,
    reasons: reasons,
  });
});

// Add this function to calculate discounts
async function calculateDiscounts(cartItems, orderTotal, userBusiness) {
  try {
    // Get active discounts for business
    const discounts = await Discount.find({
      business: userBusiness,
      status: "active",
      $or: [
        { applyToAll: true },
        { products: { $in: cartItems.map((item) => item._id) } },
        { categories: { $exists: true, $ne: [] } },
      ],
    }).populate("products categories");

    if (!discounts || discounts.length === 0) {
      return {
        applicableDiscounts: [],
        totalDiscount: 0,
        discountDetails: [],
      };
    }

    let applicableDiscounts = [];
    let totalDiscount = 0;
    let discountDetails = [];
    const now = new Date();

    for (const discount of discounts) {
      // Check validity
      if (!discount.isValid()) continue;

      // Calculate discount amount
      const discountResult = discount.calculateDiscount(cartItems, orderTotal);

      if (discountResult.discountAmount > 0) {
        applicableDiscounts.push(discount);
        totalDiscount += discountResult.discountAmount;

        discountDetails.push({
          discountId: discount._id,
          discountName: discount.name,
          discountType: discount.type,
          discountValue: discount.value || discountResult.discountAmount,
          originalAmount: discountResult.applicableItems.reduce(
            (sum, item) => sum + item.quantity * item.price,
            0,
          ),
          discountedAmount: discountResult.discountAmount,
          discountDetails: discountResult,
        });
      }
    }

    return {
      applicableDiscounts,
      totalDiscount,
      discountDetails,
    };
  } catch (error) {
    console.error("Error calculating discounts:", error);
    return {
      applicableDiscounts: [],
      totalDiscount: 0,
      discountDetails: [],
    };
  }
}


module.exports = router;
