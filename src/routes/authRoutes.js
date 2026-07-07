/**
 * Auth Routes
 * Purpose: This file defines the API routes for User Authentication (Signup/Login)
 * and retrieving active users.
 */

const express = require("express");
const router = express.Router();

// Import controllers for Auth operations
const { signup, login, getMe, getAllUsers } = require("../controllers/authController");

// Import protect middleware to guard routes using JWT tokens
const { protect } = require("../middleware/authMiddleware");

// Route for User Registration (Signup)
router.post("/signup", signup);

// Route for User Authentication (Login)
router.post("/login", login);

// Route to get Current Authenticated User Details (Requires valid JWT token)
router.get("/me", protect, getMe);

// Route to get List of all other users in the system (Requires valid JWT token)
router.get("/users", protect, getAllUsers);

module.exports = router;