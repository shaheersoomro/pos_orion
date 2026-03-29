const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Transaction = require("../models/Transaction");
const Inventory = require("../models/Inventory");
const User = require("../models/User");

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper function to parse date range
function parseDateRange(startDate, endDate) {
  const result = {};
  
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new Error('Invalid start date');
    }
    start.setHours(0, 0, 0, 0);
    result.$gte = start;
  }
  
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      throw new Error('Invalid end date');
    }
    end.setHours(23, 59, 59, 999);
    result.$lte = end;
  }
  
  return result;
}

// Helper function to convert to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

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

// ============================================
// TEST ENDPOINT
// ============================================

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

// ============================================
// CREATE TRANSACTION
// ============================================

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
        discount = 0,
        subtotal: frontendSubtotal,
        tax: frontendTax,
        total: frontendTotal,
      } = req.body;

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

          const isService = inventoryItem.category === "services";

          if (!isService && inventoryItem.quantity < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}`,
            });
          }

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

      if (appliedDiscounts && appliedDiscounts.length > 0) {
        for (const discountData of appliedDiscounts) {
          try {
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

            if (!discount.isValid()) {
              return res.status(400).json({
                success: false,
                message: `Discount "${discount.name}" is not currently valid`,
              });
            }

            const discountResult = discount.calculateDiscount(
              validatedItems,
              calculatedSubtotal,
            );

            if (discountResult.discountAmount > 0) {
              totalDiscount += discountResult.discountAmount;

              discountsApplied.push({
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
          }
        }
      }

      const discountedSubtotal = Math.max(0, calculatedSubtotal - totalDiscount);

      let finalSubtotal, finalTax, finalTotal;

      if (frontendSubtotal !== undefined && frontendTax !== undefined && frontendTotal !== undefined) {
        finalSubtotal = frontendSubtotal;
        finalTax = frontendTax;
        finalTotal = frontendTotal;
        
        console.log("Using frontend calculated values:", {
          subtotal: finalSubtotal,
          tax: finalTax,
          total: finalTotal
        });
      } else {
        if (taxInclusive) {
          finalTax = discountedSubtotal * (taxRate / (100 + taxRate));
          finalSubtotal = discountedSubtotal - finalTax;
          finalTotal = discountedSubtotal;
        } else {
          finalTax = discountedSubtotal * (taxRate / 100);
          finalSubtotal = discountedSubtotal;
          finalTotal = discountedSubtotal + finalTax;
        }
      }

      if (amountPaid < finalTotal) {
        return res.status(400).json({
          success: false,
          message: `Insufficient payment. Total: $${finalTotal.toFixed(2)}, Paid: $${amountPaid.toFixed(2)}`,
        });
      }

      const change = amountPaid - finalTotal;

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
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      });
    }
  },
);

// ============================================
// GET ALL TRANSACTIONS WITH FILTERS (UPDATED)
// ============================================

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      startDate,
      endDate,
      paymentMethod,
      status,
      search,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build the query object
    const query = { business: req.user.business };
    
    // Add date filter if provided
    if (startDate || endDate) {
      query.createdAt = parseDateRange(startDate, endDate);
    }
    
    // Add payment method filter
    if (paymentMethod && paymentMethod !== 'all' && paymentMethod !== '') {
      query.paymentMethod = paymentMethod.toLowerCase();
    }
    
    // Add status filter
    if (status && status !== 'all' && status !== '') {
      query.status = status;
    }
    
    // Add amount range filter
    if (minAmount || maxAmount) {
      query.total = {};
      if (minAmount) query.total.$gte = parseFloat(minAmount);
      if (maxAmount) query.total.$lte = parseFloat(maxAmount);
    }
    
    // Add search filter (by transaction ID or customer name)
    if (search && search.trim() !== '') {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }
    
    console.log('Transaction query:', JSON.stringify(query, null, 2)); // Debug log
    
    // Determine sort order
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute queries
    const transactions = await Transaction.find(query)
      .populate("cashier", "fullName email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Transaction.countDocuments(query);
    
    // Calculate summary for filtered results
    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalTransactions: { $sum: 1 },
          averageTransaction: { $avg: "$total" },
          totalDiscount: { $sum: "$discount" },
          totalTax: { $sum: "$tax" }
        }
      }
    ]);
    
    res.json({
      success: true,
      transactions,
      summary: summary[0] || {
        totalSales: 0,
        totalTransactions: 0,
        averageTransaction: 0,
        totalDiscount: 0,
        totalTax: 0
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        hasNextPage: parseInt(page) * parseInt(limit) < total,
        hasPrevPage: parseInt(page) > 1
      },
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        paymentMethod: paymentMethod || null,
        status: status || null,
        search: search || null
      }
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transactions",
      error: error.message
    });
  }
});

// ============================================
// GET TRANSACTION STATISTICS
// ============================================

router.get("/statistics", authenticateToken, async (req, res) => {
  try {
    const { period = 'day', startDate, endDate, paymentMethod, status } = req.query;
    
    const query = { business: req.user.business };
    
    // Apply date filters
    if (startDate || endDate) {
      query.createdAt = parseDateRange(startDate, endDate);
    }
    
    // Apply payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    
    // Apply status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    let groupBy;
    let dateFormat;
    
    switch(period) {
      case 'hour':
        groupBy = { 
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
          hour: { $hour: "$createdAt" }
        };
        dateFormat = "%Y-%m-%d %H:00";
        break;
      case 'week':
        groupBy = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" }
        };
        dateFormat = "%Y-W%V";
        break;
      case 'month':
        groupBy = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        };
        dateFormat = "%Y-%m";
        break;
      case 'year':
        groupBy = {
          year: { $year: "$createdAt" }
        };
        dateFormat = "%Y";
        break;
      default: // day
        groupBy = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        };
        dateFormat = "%Y-%m-%d";
    }
    
    const statistics = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: "$total" },
          transactionCount: { $sum: 1 },
          averageValue: { $avg: "$total" },
          totalDiscount: { $sum: "$discount" },
          totalTax: { $sum: "$tax" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    // Get payment method breakdown
    const paymentBreakdown = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          total: { $sum: "$total" }
        }
      }
    ]);
    
    res.json({
      success: true,
      statistics,
      paymentBreakdown,
      period,
      totalTransactions: statistics.reduce((sum, s) => sum + s.transactionCount, 0),
      totalSales: statistics.reduce((sum, s) => sum + s.totalSales, 0)
    });
  } catch (error) {
    console.error("Statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message
    });
  }
});

// ============================================
// EXPORT TRANSACTIONS
// ============================================

router.get("/export", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod, status, search, format = 'json' } = req.query;
    
    const query = { business: req.user.business };
    
    // Apply same filters
    if (startDate || endDate) {
      query.createdAt = parseDateRange(startDate, endDate);
    }
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search && search.trim() !== '') {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    const transactions = await Transaction.find(query)
      .populate("cashier", "fullName email")
      .sort({ createdAt: -1 })
      .lean();
    
    if (format === 'csv') {
      // Convert to CSV
      const csvData = transactions.map(t => ({
        'Transaction ID': t.transactionId,
        'Date': t.createdAt,
        'Customer': t.customer?.name || 'Walk-in',
        'Customer Phone': t.customer?.phone || '',
        'Customer Email': t.customer?.email || '',
        'Items': t.items.map(i => `${i.name} x${i.quantity}`).join('; '),
        'Subtotal': t.subtotal,
        'Discount': t.discount,
        'Tax': t.tax,
        'Total': t.total,
        'Payment Method': t.paymentMethod,
        'Status': t.status,
        'Cashier': t.cashier?.fullName || 'System',
        'Notes': t.notes || ''
      }));
      
      const csv = convertToCSV(csvData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=transactions_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }
    
    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting transactions",
      error: error.message
    });
  }
});

// ============================================
// GET TODAY'S SUMMARY
// ============================================

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
          averageTransaction: { $avg: "$total" },
        },
      },
    ];

    const result = await Transaction.aggregate(pipeline);

    let summary;
    if (result.length > 0) {
      summary = {
        totalSales: result[0].totalSales || 0,
        transactionCount: result[0].transactionCount || 0,
        averageTransaction: result[0].averageTransaction || 0,
      };
    } else {
      summary = {
        totalSales: 0,
        transactionCount: 0,
        averageTransaction: 0,
      };
    }

    res.json({
      success: true,
      summary: {
        totalSales: summary.totalSales.toFixed(2),
        transactionCount: summary.transactionCount,
        averageTransaction: summary.averageTransaction.toFixed(2),
        formattedTotal: `$${summary.totalSales.toFixed(2)}`,
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
        averageTransaction: "0.00",
      },
    });
  }
});

// ============================================
// GET NEXT ORDER NUMBER
// ============================================

router.get("/next-order-number", authenticateToken, async (req, res) => {
  try {
    const today = new Date();

    const year = today.getFullYear().toString().slice(-2);
    const day = today.getDate().toString().padStart(2, "0");
    const month = (today.getMonth() + 1).toString().padStart(2, "0");

    const datePrefix = `${year}-${day}-${month}`;

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await Transaction.countDocuments({
      business: req.user.business,
      status: "completed",
      createdAt: { $gte: todayStart, $lt: tomorrow },
    });

    const nextSequence = todayCount + 1;

    if (nextSequence > 9999) {
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
        nextOrderNumber: `${datePrefix}-${nextSequence.toString().padStart(4, "0")}`,
        displayNumber: nextSequence.toString().padStart(4, "0"),
        datePrefix,
        sequence: nextSequence,
      });
    }
  } catch (error) {
    console.error("Error getting next order number:", error);
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

// ============================================
// GET SINGLE TRANSACTION
// ============================================

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

// ============================================
// REFUND TRANSACTION
// ============================================

router.post("/:id/refund", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { refundItems, reason, partialRefund = false } = req.body;

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

    if (transaction.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Transaction already refunded",
      });
    }

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

        inventoryUpdates.push({
          productId: originalItem.productId,
          quantity: refundItem.quantity,
          name: originalItem.name,
        });
      }
    } else {
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
      tax: 0,
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

    // Update inventory
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

// ============================================
// GET REFUND REASONS
// ============================================

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

module.exports = router;