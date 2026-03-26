const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const User = require("../models/User");

const discountValidation = [
  body("discountType")
    .optional()
    .isIn(["none", "percentage", "fixed"])
    .withMessage("Invalid discount type"),
  body("discountValue")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number"),
  body("discountStartDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  body("discountEndDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
  body("discountActive")
    .optional()
    .isBoolean()
    .withMessage("Discount active must be boolean"),
];

// Middleware to verify JWT token
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
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("User lookup error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error during authentication",
        });
    }
  });
};

// GET all inventory items for the business
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      category,
      search,
      status,
      sort = "name",
      order = "asc",
    } = req.query;

    // Build query
    let query = { business: req.user.business };

    // Apply category filter
    if (category && category !== "all") {
      query.category = category;
    }

    // Apply search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { productId: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Apply status filter
    if (status && status !== "all") {
      if (status === "low_stock") {
        query.quantity = { $lte: "$lowStockThreshold", $gt: 0 };
      } else if (status === "out_of_stock") {
        query.quantity = 0;
      } else if (status === "in_stock") {
        query.quantity = { $gt: 0 };
      }
    }

    // Get total count for pagination
    const total = await Inventory.countDocuments(query);

    // Get inventory items
    let sortObj = {};
    sortObj[sort] = order === "desc" ? -1 : 1;

    const inventory = await Inventory.find(query)
      .sort(sortObj)
      .populate("createdBy", "fullName email")
      .lean();

    // Add stock status to each item
    const inventoryWithStatus = inventory.map((item) => {
      let stockStatus;
      if (item.category === "services") {
        stockStatus = "service";
      } else if (item.quantity <= 0) {
        stockStatus = "out_of_stock";
      } else if (item.quantity <= item.lowStockThreshold) {
        stockStatus = "low_stock";
      } else if (item.quantity <= item.lowStockThreshold * 3) {
        stockStatus = "medium_stock";
      } else {
        stockStatus = "in_stock";
      }

      return {
        ...item,
        stockStatus,
        createdBy: item.createdBy
          ? {
              name: item.createdBy.fullName,
              email: item.createdBy.email,
            }
          : null,
      };
    });

    res.json({
      success: true,
      inventory: inventoryWithStatus,
      total,
      page: 1,
      limit: 100,
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching inventory",
    });
  }
});

// GET single inventory item
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const inventory = await Inventory.findOne({
      _id: req.params.id,
      business: req.user.business,
    }).populate("createdBy", "fullName email");

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.json({
      success: true,
      inventory,
    });
  } catch (error) {
    console.error("Get inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching inventory item",
    });
  }
});

// POST create new inventory item
router.post(
  "/",
  authenticateToken,
  [
    body("name").trim().notEmpty().withMessage("Product name is required"),
    body("category").notEmpty().withMessage("Category is required"), 
    body("price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),
    body("quantity")
      .isInt({ min: 0 })
      .withMessage("Quantity must be a positive integer"),
    body("lowStockThreshold").optional().isInt({ min: 0 }),
    body("cost").optional().isFloat({ min: 0 }),
    body("unit").optional().trim(),
    body("barcode").optional().trim(),
    body("supplier").optional().trim(),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
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

      // Check if product with same name already exists in business
      const existingProduct = await Inventory.findOne({
        name: req.body.name,
        business: req.user.business,
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          errors: [
            {
              field: "name",
              message: "Product with this name already exists",
            },
          ],
        });
      }

      // Create new inventory item
      const inventory = new Inventory({
        ...req.body,
        business: req.user.business,
        createdBy: req.user._id,
      });

      await inventory.save();

      res.status(201).json({
        success: true,
        message: "Product added successfully",
        inventory: {
          ...inventory.toObject(),
          stockStatus: inventory.stockStatus,
        },
      });
    } catch (error) {
      console.error("Create inventory error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while creating product",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// PUT update inventory item
router.put(
  "/:id",
  authenticateToken,
  [
    body("name").trim().notEmpty().withMessage("Product name is required"),
    body("category").custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid category ID");
      }
      return true;
    }),
    body("price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),
    body("quantity")
      .isInt({ min: 0 })
      .withMessage("Quantity must be a positive integer"),
    body("lowStockThreshold").optional().isInt({ min: 0 }),
    body("cost").optional().isFloat({ min: 0 }),
    body("unit").optional().trim(),
    body("barcode").optional().trim(),
    body("supplier").optional().trim(),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
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

      // Find inventory item
      const inventory = await Inventory.findOne({
        _id: req.params.id,
        business: req.user.business,
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: "Inventory item not found",
        });
      }

      // Check if new name conflicts with existing product (excluding current)
      if (req.body.name !== inventory.name) {
        const existingProduct = await Inventory.findOne({
          name: req.body.name,
          business: req.user.business,
          _id: { $ne: req.params.id },
        });

        if (existingProduct) {
          return res.status(400).json({
            success: false,
            errors: [
              {
                field: "name",
                message: "Product with this name already exists",
              },
            ],
          });
        }
      }

      // Update inventory item
      Object.assign(inventory, req.body);
      await inventory.save();

      res.json({
        success: true,
        message: "Product updated successfully",
        inventory: {
          ...inventory.toObject(),
          stockStatus: inventory.stockStatus,
        },
      });
    } catch (error) {
      console.error("Update inventory error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating product",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// DELETE inventory item
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const inventory = await Inventory.findOneAndDelete({
      _id: req.params.id,
      business: req.user.business,
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting product",
    });
  }
});

// POST update stock (restock or sell)
router.post(
  "/:id/stock",
  authenticateToken,
  [
    body("quantity").isInt().withMessage("Quantity must be an integer"),
    body("type")
      .isIn(["restock", "sell", "adjust"])
      .withMessage("Invalid stock update type"),
    body("reason").optional().trim(),
    body("notes").optional().trim(),
  ],
  async (req, res) => {
    try {
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

      const inventory = await Inventory.findOne({
        _id: req.params.id,
        business: req.user.business,
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: "Inventory item not found",
        });
      }

      let quantityChange = req.body.quantity;

      if (req.body.type === "sell") {
        quantityChange = -Math.abs(quantityChange);
      } else if (req.body.type === "restock") {
        quantityChange = Math.abs(quantityChange);
      }

      // Update stock
      await inventory.updateStock(quantityChange, req.body.type === "restock");

      // In a real application, you might want to log this transaction
      // to a separate StockHistory collection

      res.json({
        success: true,
        message: "Stock updated successfully",
        inventory: {
          ...inventory.toObject(),
          stockStatus: inventory.stockStatus,
        },
      });
    } catch (error) {
      console.error("Update stock error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating stock",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// GET inventory statistics
router.get("/stats/summary", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.business;

    // Get total products count
    const totalProducts = await Inventory.countDocuments({
      business: businessId,
    });

    // Get low stock items (excluding services)
    const lowStockItems = await Inventory.countDocuments({
      business: businessId,
      category: { $ne: "services" },
      quantity: { $lte: "$lowStockThreshold", $gt: 0 },
    });

    // Get out of stock items (excluding services)
    const outOfStockItems = await Inventory.countDocuments({
      business: businessId,
      category: { $ne: "services" },
      quantity: 0,
    });

    // Get total inventory value
    const inventoryValue = await Inventory.aggregate([
      { $match: { business: mongoose.Types.ObjectId(businessId) } },
      {
        $project: {
          value: { $multiply: ["$price", "$quantity"] },
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$value" },
        },
      },
    ]);

    const totalValue = inventoryValue[0]?.totalValue || 0;

    // Get category distribution
    const categoryDistribution = await Inventory.aggregate([
      { $match: { business: mongoose.Types.ObjectId(businessId) } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$price", "$quantity"] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalProducts,
        lowStockItems,
        outOfStockItems,
        totalValue: parseFloat(totalValue.toFixed(2)),
        categoryDistribution,
      },
    });
  } catch (error) {
    console.error("Get inventory stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching inventory statistics",
    });
  }
});

module.exports = router;
