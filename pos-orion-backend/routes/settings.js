const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Business = require("../models/Business");
const Permission = require("../models/Permission");

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error("JWT verification error:", err.message);
      return res.status(403).json({ success: false, message: "Invalid or expired token" });
    }

    try {
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("User lookup error:", error);
      res.status(500).json({ success: false, message: "Server error during authentication" });
    }
  });
};

// Middleware to check if user has permission to EDIT settings
const requireEditSettingsPermission = async (req, res, next) => {
  try {
    const permissions = await Permission.findOne({ business: req.user.business });

    if (!permissions) {
      // If no permissions configured, only admin can edit
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to edit settings",
        });
      }
      return next();
    }

    const hasPermission = permissions.hasPermission(req.user.role, "canManageSettings");

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to edit settings",
      });
    }

    next();
  } catch (error) {
    console.error("Permission check error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking permissions",
    });
  }
};

// GET business settings - EVERYONE can view
router.get("/business", authenticateToken, async (req, res) => {
  try {
    const business = await Business.findById(req.user.business).populate("owner", "fullName email");

    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
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
        owner: business.owner ? { fullName: business.owner.fullName, email: business.owner.email } : null,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get business settings error:", error);
    res.status(500).json({ success: false, message: "Server error while fetching business settings" });
  }
});

// UPDATE business settings - ONLY users with canManageSettings: true can edit
router.put(
  "/business",
  authenticateToken,
  requireEditSettingsPermission, // Check permission for editing
  [
    body("name").trim().notEmpty().withMessage("Business name is required"),
    body("type").isIn(["retail", "restaurant", "service", "ecommerce", "wholesale", "salon", "grocery", "other"]).withMessage("Invalid business type"),
    body("phone").trim().notEmpty().withMessage("Phone number is required"),
    body("address").trim().notEmpty().withMessage("Address is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
        });
      }

      const business = await Business.findById(req.user.business);
      if (!business) {
        return res.status(404).json({ success: false, message: "Business not found" });
      }

      business.name = req.body.name;
      business.type = req.body.type;
      business.phone = req.body.phone;
      business.address = req.body.address;

      await business.save();

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
      res.status(500).json({ success: false, message: "Server error while updating business settings" });
    }
  }
);

// UPDATE tax settings - ONLY users with canManageSettings: true can edit
router.put(
  "/tax",
  authenticateToken,
  requireEditSettingsPermission, // Check permission for editing
  [
    body("enabled").isBoolean().withMessage("Tax enabled must be a boolean"),
    body("rate").isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),
    body("taxName").optional({ checkFalsy: true }).trim(),
    body("taxInclusive").optional().isBoolean().withMessage("Tax inclusive must be a boolean"),
    body("registeredTaxId").optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
        });
      }

      const business = await Business.findById(req.user.business);
      if (!business) {
        return res.status(404).json({ success: false, message: "Business not found" });
      }

      business.taxSettings = {
        enabled: req.body.enabled,
        rate: req.body.rate,
        taxName: req.body.taxName || "Sales Tax",
        taxInclusive: req.body.taxInclusive !== undefined ? req.body.taxInclusive : true,
        registeredTaxId: req.body.registeredTaxId || '',

      };

      await business.save();

      res.json({
        success: true,
        message: "Tax settings updated successfully",
        taxSettings: business.taxSettings,
      });
    } catch (error) {
      console.error("Update tax settings error:", error);
      res.status(500).json({ success: false, message: "Server error while updating tax settings" });
    }
  }
);

module.exports = router;