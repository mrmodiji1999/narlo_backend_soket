/**
 * Message Routes
 * Purpose: Maps HTTP requests for chat message history to the message controller.
 * All route parameters are authenticated using the JWT authorization protect middleware.
 */

const express = require("express");
const router = express.Router();

// Import message controllers
const { getPrivateHistory, getRoomHistory } = require("../controllers/messageController");

// Import token protection middleware
const { protect } = require("../middleware/authMiddleware");

// Route to fetch 1:1 private message history between current user and specified user
router.get("/private/:userId", protect, getPrivateHistory);

// Route to fetch group room message history for a specified room ID
router.get("/room/:roomId", protect, getRoomHistory);

module.exports = router;
