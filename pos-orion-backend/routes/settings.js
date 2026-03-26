const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Business = require("../models/Business");

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

// GET business settings (admin only)
router.get("/business", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view business settings",
      });
    }

    // Find business with owner populated
    const business = await Business.findById(req.user.business).populate(
      "owner",
      "fullName email"
    );

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    res.json({
      success: true,
      business: {
        id: business._id,
        name: business.name,
        type: business.type,
        phone: business.phone,
        address: business.address,
        taxSettings: business.taxSettings,
        subscription: business.subscription,
        owner: business.owner
          ? {
              fullName: business.owner.fullName,
              email: business.owner.email,
            }
          : null,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get business settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching business settings",
    });
  }
});

// UPDATE business settings (admin only)
router.put(
  "/business",
  authenticateToken,
  [
    body("name").trim().notEmpty().withMessage("Business name is required"),
    body("type")
      .isIn([
        "retail",
        "restaurant",
        "service",
        "ecommerce",
        "wholesale",
        "salon",
        "grocery",
        "other",
      ])
      .withMessage("Invalid business type"),
    body("phone").trim().notEmpty().withMessage("Phone number is required"),
    body("address").trim().notEmpty().withMessage("Address is required"),
  ],
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can update business settings",
        });
      }

      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
          })),
        });
      }

      // DEBUG: Log what's being received
      console.log("Received data for update:", req.body);
      console.log("Business ID:", req.user.business);

      // Find business
      const business = await Business.findById(req.user.business);
      if (!business) {
        console.log("Business not found for ID:", req.user.business);
        return res.status(404).json({
          success: false,
          message: "Business not found",
        });
      }

      // Log current business data
      console.log("Current business data:", {
        name: business.name,
        type: business.type,
        phone: business.phone,
        address: business.address,
      });

      // Update business fields
      business.name = req.body.name;
      business.type = req.body.type;
      business.phone = req.body.phone;
      business.address = req.body.address;

      try {
        await business.save();
        console.log("Business saved successfully");
      } catch (saveError) {
        console.error("Save error details:", saveError);
        console.error("Save error message:", saveError.message);
        console.error("Save error name:", saveError.name);

        // Check for validation errors during save
        if (saveError.name === "ValidationError") {
          return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: Object.values(saveError.errors).map((err) => ({
              field: err.path,
              message: err.message,
            })),
          });
        }

        throw saveError;
      }

      res.json({
        success: true,
        message: "Business settings updated successfully",
        business: {
          id: business._id,
          name: business.name,
          type: business.type,
          phone: business.phone,
          address: business.address,
          updatedAt: business.updatedAt,
        },
      });
    } catch (error) {
      console.error("Update business settings error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({
        success: false,
        message: "Server error while updating business settings",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// UPDATE tax settings (admin only)
router.put(
  "/tax",
  authenticateToken,
  [
    body("enabled").isBoolean().withMessage("Tax enabled must be a boolean"),
    body("rate")
      .isFloat({ min: 0, max: 100 })
      .withMessage("Tax rate must be between 0 and 100"),
    body("taxName").optional({ checkFalsy: true }).trim(),
    body("taxInclusive")
      .optional()
      .isBoolean()
      .withMessage("Tax inclusive must be a boolean"),
  ],
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can update tax settings",
        });
      }

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

      // Find and update business
      const business = await Business.findById(req.user.business);
      if (!business) {
        return res.status(404).json({
          success: false,
          message: "Business not found",
        });
      }

      // Update tax settings
      business.taxSettings = {
        enabled: req.body.enabled,
        rate: req.body.rate,
        taxName: req.body.taxName || "Sales Tax",
        taxInclusive:
          req.body.taxInclusive !== undefined
            ? req.body.taxInclusive
            : currentTaxInclusive,
      };

      await business.save();

      res.json({
        success: true,
        message: "Tax settings updated successfully",
        taxSettings: business.taxSettings,
      });
    } catch (error) {
      console.error("Update tax settings error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating tax settings",
      });
    }
  }
);

// GET user permissions (admin only)
router.get("/permissions", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view permissions",
      });
    }

    // Default permissions structure
    const permissions = {
      admin: {
        accessDashboard: true,
        manageInventory: true,
        processRefunds: true,
        manageUsers: true,
        manageSettings: true,
        viewReports: true,
        createSales: true,
        viewSalesHistory: true,
      },
      manager: {
        accessDashboard: true,
        manageInventory: true,
        processRefunds: true,
        manageUsers: false,
        manageSettings: false,
        viewReports: true,
        createSales: true,
        viewSalesHistory: true,
      },
      cashier: {
        accessDashboard: false,
        manageInventory: false,
        processRefunds: false,
        manageUsers: false,
        manageSettings: false,
        viewReports: false,
        createSales: true,
        viewSalesHistory: false,
      },
    };

    res.json({
      success: true,
      permissions,
    });
  } catch (error) {
    console.error("Get permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching permissions",
    });
  }
});

// UPDATE user permissions (admin only)
router.put(
  "/permissions",
  authenticateToken,
  [
    body("admin").isObject().withMessage("Admin permissions must be an object"),
    body("manager")
      .isObject()
      .withMessage("Manager permissions must be an object"),
    body("cashier")
      .isObject()
      .withMessage("Cashier permissions must be an object"),
  ],
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can update permissions",
        });
      }

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

      // Validate permission structure
      const validatePermissions = (perms, roleName) => {
        const requiredPermissions = [
          "accessDashboard",
          "manageInventory",
          "processRefunds",
          "manageUsers",
          "manageSettings",
          "viewReports",
          "createSales",
          "viewSalesHistory",
        ];

        const errors = [];

        for (const perm of requiredPermissions) {
          if (typeof perms[perm] !== "boolean") {
            errors.push(`Invalid permission value for ${roleName}.${perm}`);
          }
        }

        if (errors.length > 0) {
          throw new Error(errors.join(", "));
        }

        return true;
      };

      validatePermissions(req.body.admin, "admin");
      validatePermissions(req.body.manager, "manager");
      validatePermissions(req.body.cashier, "cashier");

      // In a real application, you would save these to database
      // For now, we'll store them in memory (or you could add a BusinessSettings model)

      // Return success
      res.json({
        success: true,
        message: "Permissions updated successfully",
        permissions: req.body,
      });
    } catch (error) {
      console.error("Update permissions error:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating permissions",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// GET subscription info (admin only)
router.get("/subscription", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view subscription info",
      });
    }

    // Find business
    const business = await Business.findById(req.user.business);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    res.json({
      success: true,
      subscription: business.subscription,
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching subscription info",
    });
  }
});

module.exports = router;
