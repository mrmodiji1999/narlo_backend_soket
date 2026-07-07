/**
 * Room Controller
 * Purpose: This controller handles group chat room creation and retrieval.
 * It uses the Room database model to store and fetch group channels.
 */

const Room = require("../models/Room");

// @desc    Create a new group chat room
// @route   POST /api/rooms
// @access  Private
const createRoom = async (req, res) => {
    try {
        const { name, description, members } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Room name is required",
            });
        }

        // Initialize members array with the creator (current logged in user)
        let roomMembers = [req.user._id];

        // Add extra members if provided
        if (members && Array.isArray(members)) {
            members.forEach((memberId) => {
                if (memberId && !roomMembers.includes(memberId)) {
                    roomMembers.push(memberId);
                }
            });
        }

        // Create the room document in MongoDB
        const room = await Room.create({
            name,
            description: description || "",
            createdBy: req.user._id,
            members: roomMembers,
            isGroup: true,
        });

        // Populate members information before returning the response
        const populatedRoom = await room.populate("members", "name profileImage isOnline");

        res.status(201).json({
            success: true,
            message: "Group Room Created Successfully",
            room: populatedRoom,
        });
    } catch (error) {
        console.error("Create Room Error:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

// @desc    Get all rooms that the current user belongs to
// @route   GET /api/rooms
// @access  Private
const getRooms = async (req, res) => {
    try {
        // Find rooms where the current user ID exists in the members list
        const rooms = await Room.find({ members: req.user._id })
            .populate("members", "name profileImage isOnline")
            .sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            rooms,
        });
    } catch (error) {
        console.error("Get Rooms Error:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

module.exports = {
    createRoom,
    getRooms,
};
