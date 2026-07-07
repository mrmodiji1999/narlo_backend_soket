/**
 * Message Controller
 * Purpose: Handles fetching chat histories from MongoDB.
 * It fetches both One-to-One (1:1) private messages and Group Chat room histories.
 */

const Message = require("../models/Message");

// @desc    Get private message history between current user and another user (1:1 chat)
// @route   GET /api/messages/private/:userId
// @access  Private
const getPrivateHistory = async (req, res) => {
    try {
        const otherUserId = req.params.userId;
        const currentUserId = req.user._id;

        // Query: find messages where:
        // (sender = current user AND recipient = other user)
        // OR
        // (sender = other user AND recipient = current user)
        const messages = await Message.find({
            $or: [
                { sender: currentUserId, recipient: otherUserId },
                { sender: otherUserId, recipient: currentUserId },
            ],
        })
            .populate("sender", "name profileImage")
            .populate("recipient", "name profileImage")
            .sort({ createdAt: 1 }) // Chronological order: oldest first for chat flow
            .limit(100);

        // Format message payload for client
        const formattedMessages = messages.map((msg) => ({
            _id: msg._id,
            senderId: msg.sender?._id || null,
            senderName: msg.sender?.name || "Unknown User",
            recipientId: msg.recipient?._id || null,
            recipientName: msg.recipient?.name || "Unknown User",
            text: msg.text,
            createdAt: msg.createdAt,
        }));

        res.status(200).json({
            success: true,
            messages: formattedMessages,
        });
    } catch (error) {
        console.error("Error fetching private history:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

// @desc    Get group chat history for a specific room
// @route   GET /api/messages/room/:roomId
// @access  Private
const getRoomHistory = async (req, res) => {
    try {
        const roomId = req.params.roomId;

        // Query: find messages sent to this specific room ID
        const messages = await Message.find({ room: roomId })
            .populate("sender", "name profileImage")
            .sort({ createdAt: 1 }) // Chronological order
            .limit(100);

        // Format message payload for client
        const formattedMessages = messages.map((msg) => ({
            _id: msg._id,
            senderId: msg.sender?._id || null,
            senderName: msg.sender?.name || "Unknown User",
            roomId: roomId,
            text: msg.text,
            createdAt: msg.createdAt,
        }));

        res.status(200).json({
            success: true,
            messages: formattedMessages,
        });
    } catch (error) {
        console.error("Error fetching room history:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

module.exports = {
    getPrivateHistory,
    getRoomHistory,
};
