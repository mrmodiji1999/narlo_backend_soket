/**
 * Room Routes
 * Purpose: This file maps endpoints for managing group rooms to their controllers.
 * All routes here require verification via the JWT authentication protect middleware.
 */

const express = require("express");
const router = express.Router();

// Import room controllers
const { createRoom, getRooms } = require("../controllers/roomController");

// Import token protection middleware
const { protect } = require("../middleware/authMiddleware");

// Route to create a new group room (POST /api/rooms)
router.post("/", protect, createRoom);

// Route to get list of group rooms current user is part of (GET /api/rooms)
router.get("/", protect, getRooms);

module.exports = router;
