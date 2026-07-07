/**
 * Server Main Entry Point (Pure Socket.io Architecture)
 * Purpose: This file establishes the pure socket server for the Narlo Backend. It:
 * 1. Initializes Express (solely for health check GET /).
 * 2. Connects to the MongoDB Database.
 * 3. Sets up a Socket.io server.
 * 4. Implements ALL backend API operations (Authentication, User list, Group Rooms, Histories, Chat, Typing)
 *    exclusively over WebSockets using custom event emits, listeners, and acknowledgements.
 */

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Config & MongoDB database schemas
const connectDB = require("./config/database");
const User = require("./models/User");
const Message = require("./models/Message");
const Room = require("./models/Room");

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with wildcard CORS origin
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const PORT = process.env.PORT || 3000;

// Middleware configurations
app.use(cors());
app.use(express.json());

// Connect to MongoDB Database
connectDB();

// JWT Generator Helper function
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || "narlo_super_secret_key_2026", {
        expiresIn: "30d",
    });
};

/* ================= SOCKET.IO GATEWAY HANDLERS ================= */
io.on("connection", (socket) => {
    console.log(`🔌 New client socket connected. Socket ID: ${socket.id}`);

    // Middleware to log all incoming socket events and payloads
    socket.use((packet, next) => {
        const eventName = packet[0];
        const eventData = packet[1];
        console.log(`📥 [Socket Backend - Incoming] Event: '${eventName}' | Payload:`, JSON.stringify(eventData));
        next();
    });

    // Helper to check if socket session has been authenticated
    const checkAuth = (callback) => {
        if (!socket.userId) {
            if (callback) {
                callback({ success: false, message: "Authentication required" });
            }
            return false;
        }
        return true;
    };

    /* ------------ PUBLIC EVENTS (No auth required initially) ------------ */

    // EVENT: signup
    // Purpose: Registers a user in database, generates token, and authenticates current socket session
    socket.on("signup", async (data, callback) => {
        console.log("📝 Socket signup event received:", data.email);
        try {
            const { name, email, password } = data;

            if (!name || !email || !password) {
                return callback({ success: false, message: "All fields are required" });
            }

            // Check if user already registered
            const userExists = await User.findOne({ email });
            if (userExists) {
                return callback({ success: false, message: "User already exists with this email" });
            }

            // Encrypt user password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Save user to MongoDB
            const user = await User.create({
                name,
                email,
                password: hashedPassword,
                isOnline: true,
                socketId: socket.id,
                lastSeen: new Date()
            });

            // Bind authentication parameters to current socket session
            socket.userId = user._id.toString();
            socket.userName = user.name;

            // Generate authentication token
            const token = generateToken(user._id);

            // Broadcast online status to other sockets
            io.emit("user_status", {
                userId: socket.userId,
                isOnline: true,
                lastSeen: user.lastSeen
            });

            console.log(`💾 User registered and connected over socket: ${user.name}`);
            callback({
                success: true,
                token,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email
                }
            });
        } catch (error) {
            console.error("Socket Signup Error:", error);
            callback({ success: false, message: "Server Error during signup" });
        }
    });

    // EVENT: login
    // Purpose: Validates credentials, creates token, and logs user into current socket session
    socket.on("login", async (data, callback) => {
        console.log("🔑 Socket login event received:", data.email);
        try {
            const { email, password } = data;

            if (!email || !password) {
                return callback({ success: false, message: "Email and password are required" });
            }

            // Fetch user profile from DB
            const user = await User.findOne({ email });
            if (!user) {
                return callback({ success: false, message: "Invalid email or password" });
            }

            // Check password validity
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return callback({ success: false, message: "Invalid email or password" });
            }

            // Update user status in MongoDB
            user.isOnline = true;
            user.socketId = socket.id;
            user.lastSeen = new Date();
            await user.save();

            // Bind credentials to socket session
            socket.userId = user._id.toString();
            socket.userName = user.name;

            // Generate auth token
            const token = generateToken(user._id);

            // Broadcast status change
            io.emit("user_status", {
                userId: socket.userId,
                isOnline: true,
                lastSeen: user.lastSeen
            });

            console.log(`💾 User logged in and connected over socket: ${user.name}`);
            callback({
                success: true,
                token,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email
                }
            });
        } catch (error) {
            console.error("Socket Login Error:", error);
            callback({ success: false, message: "Server Error during login" });
        }
    });

    // EVENT: authenticate
    // Purpose: Autologins a socket connection on load if a client holds a persistent JWT token
    socket.on("authenticate", async (data, callback) => {
        console.log("🔒 Socket authenticate event received");
        try {
            const { token } = data;
            if (!token) {
                return callback({ success: false, message: "No token provided" });
            }

            // Decode token details
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "narlo_super_secret_key_2026");
            const user = await User.findById(decoded.id);

            if (!user) {
                return callback({ success: false, message: "User not found" });
            }

            // Update user status
            user.isOnline = true;
            user.socketId = socket.id;
            user.lastSeen = new Date();
            await user.save();

            // Bind data to socket
            socket.userId = user._id.toString();
            socket.userName = user.name;

            // Broadcast presence status
            io.emit("user_status", {
                userId: socket.userId,
                isOnline: true,
                lastSeen: user.lastSeen
            });

            console.log(`💾 User session auto-authenticated: ${user.name}`);
            callback({
                success: true,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email
                }
            });
        } catch (error) {
            console.error("Socket Auth Error:", error.message);
            callback({ success: false, message: "Invalid or expired token" });
        }
    });

    /* ------------ PROTECTED EVENTS (Auth required) ------------ */

    // EVENT: get_users
    // Purpose: Fetches list of other registered users
    socket.on("get_users", async (callback) => {
        if (!checkAuth(callback)) return;
        try {
            const users = await User.find({ _id: { $ne: socket.userId } })
                .select("-password")
                .sort({ isOnline: -1, name: 1 });

            callback({ success: true, users });
        } catch (error) {
            console.error("Socket get_users error:", error);
            callback({ success: false, message: "Failed to fetch users" });
        }
    });

    // EVENT: get_rooms
    // Purpose: Fetches all rooms current user belongs to
    socket.on("get_rooms", async (callback) => {
        if (!checkAuth(callback)) return;
        try {
            const rooms = await Room.find({ members: socket.userId })
                .populate("members", "name isOnline")
                .sort({ updatedAt: -1 });

            callback({ success: true, rooms });
        } catch (error) {
            console.error("Socket get_rooms error:", error);
            callback({ success: false, message: "Failed to fetch rooms" });
        }
    });

    // EVENT: create_room
    // Purpose: Creates a new group channel and joins members
    socket.on("create_room", async (data, callback) => {
        if (!checkAuth(callback)) return;
        try {
            const { name, description, members } = data;

            if (!name) {
                return callback({ success: false, message: "Group name is required" });
            }

            let roomMembers = [socket.userId];
            if (members && Array.isArray(members)) {
                members.forEach(id => {
                    if (id && !roomMembers.includes(id)) {
                        roomMembers.push(id);
                    }
                });
            }

            const room = await Room.create({
                name,
                description: description || "",
                createdBy: socket.userId,
                members: roomMembers,
                isGroup: true
            });

            const populatedRoom = await room.populate("members", "name isOnline");

            // Creator socket joins room immediately
            socket.join(room._id.toString());

            // If other members are currently online, add their active sockets to this channel room
            populatedRoom.members.forEach(async (member) => {
                if (member._id.toString() !== socket.userId) {
                    const memberUser = await User.findById(member._id);
                    if (memberUser && memberUser.isOnline && memberUser.socketId) {
                        const memberSocket = io.sockets.sockets.get(memberUser.socketId);
                        if (memberSocket) {
                            memberSocket.join(room._id.toString());
                            // Notify member that they have been added to a new group
                            memberSocket.emit("room_added", populatedRoom);
                        }
                    }
                }
            });

            console.log(`💾 Group Room created: ${room.name}`);
            callback({ success: true, room: populatedRoom });
        } catch (error) {
            console.error("Socket create_room error:", error);
            callback({ success: false, message: "Failed to create group" });
        }
    });

    // EVENT: get_private_history
    // Purpose: Retrieves historical DMs between current user and specified user
    socket.on("get_private_history", async (data, callback) => {
        if (!checkAuth(callback)) return;
        try {
            const { otherUserId } = data;
            const messages = await Message.find({
                $or: [
                    { sender: socket.userId, recipient: otherUserId },
                    { sender: otherUserId, recipient: socket.userId }
                ]
            })
                .populate("sender", "name")
                .sort({ createdAt: 1 })
                .limit(100);

            const formattedMessages = messages.map(msg => ({
                _id: msg._id,
                senderId: msg.sender?._id || null,
                senderName: msg.sender?.name || "Unknown User",
                recipientId: msg.recipient,
                text: msg.text,
                createdAt: msg.createdAt
            }));

            callback({ success: true, messages: formattedMessages });
        } catch (error) {
            console.error("Socket get_private_history error:", error);
            callback({ success: false, message: "Failed to fetch private chat history" });
        }
    });

    // EVENT: get_room_history
    // Purpose: Retrieves historical chats for a specific group channel
    socket.on("get_room_history", async (data, callback) => {
        if (!checkAuth(callback)) return;
        try {
            const { roomId } = data;
            const messages = await Message.find({ room: roomId })
                .populate("sender", "name")
                .sort({ createdAt: 1 })
                .limit(100);

            const formattedMessages = messages.map(msg => ({
                _id: msg._id,
                senderId: msg.sender?._id || null,
                senderName: msg.sender?.name || "Unknown User",
                roomId: roomId,
                text: msg.text,
                createdAt: msg.createdAt
            }));

            callback({ success: true, messages: formattedMessages });
        } catch (error) {
            console.error("Socket get_room_history error:", error);
            callback({ success: false, message: "Failed to fetch group chat history" });
        }
    });

    // EVENT: join_room (socket joins a room channel)
    socket.on("join_room", (roomId) => {
        if (!checkAuth()) return;
        socket.join(roomId);
        console.log(`👥 ${socket.userName} joined room: ${roomId}`);
    });

    // EVENT: leave_room (socket leaves a room channel)
    socket.on("leave_room", (roomId) => {
        if (!checkAuth()) return;
        socket.leave(roomId);
        console.log(`👥 ${socket.userName} left room: ${roomId}`);
    });

    // EVENT: send_private_message
    socket.on("send_private_message", async (data) => {
        if (!checkAuth()) return;
        try {
            const { recipientId, text } = data;

            const newMessage = await Message.create({
                sender: socket.userId,
                recipient: recipientId,
                text: text
            });

            const formattedMessage = {
                _id: newMessage._id,
                senderId: socket.userId,
                senderName: socket.userName,
                recipientId: recipientId,
                text: text,
                createdAt: newMessage.createdAt
            };

            const recipientUser = await User.findById(recipientId);

            // Forward event only to recipient's socket if online
            if (recipientUser && recipientUser.isOnline && recipientUser.socketId) {
                io.to(recipientUser.socketId).emit("receive_private_message", formattedMessage);
            }

            // Echo back to sender
            socket.emit("receive_private_message", formattedMessage);

            console.log(`💾 Private Message saved to MongoDB. Message ID: ${newMessage._id}`);
        } catch (error) {
            console.error("Socket private message error:", error);
        }
    });

    // EVENT: send_group_message
    socket.on("send_group_message", async (data) => {
        if (!checkAuth()) return;
        try {
            const { roomId, text } = data;

            const newMessage = await Message.create({
                sender: socket.userId,
                room: roomId,
                text: text
            });

            const formattedMessage = {
                _id: newMessage._id,
                senderId: socket.userId,
                senderName: socket.userName,
                roomId: roomId,
                text: text,
                createdAt: newMessage.createdAt
            };

            // Broadcast message to room
            io.to(roomId).emit("receive_group_message", formattedMessage);

            console.log(`💾 Group Message saved to MongoDB. Message ID: ${newMessage._id}`);
        } catch (error) {
            console.error("Socket group message error:", error);
        }
    });

    // EVENT: typing_status
    socket.on("typing_status", async (data) => {
        if (!checkAuth()) return;
        const { recipientId, roomId, isTyping } = data;

        if (recipientId) {
            const recipientUser = await User.findById(recipientId);
            if (recipientUser && recipientUser.isOnline && recipientUser.socketId) {
                io.to(recipientUser.socketId).emit("typing_status", {
                    senderId: socket.userId,
                    isTyping: isTyping
                });
            }
        } else if (roomId) {
            socket.to(roomId).emit("typing_status", {
                senderId: socket.userId,
                roomId: roomId,
                isTyping: isTyping
            });
        }
    });

    // EVENT: disconnect
    socket.on("disconnect", async () => {
        console.log(`🔌 Socket client disconnected: ${socket.id}`);
        if (socket.userId) {
            try {
                const lastSeenTime = new Date();

                await User.findByIdAndUpdate(socket.userId, {
                    isOnline: false,
                    socketId: "",
                    lastSeen: lastSeenTime
                });

                // Broadcast presence status
                io.emit("user_status", {
                    userId: socket.userId,
                    isOnline: false,
                    lastSeen: lastSeenTime
                });

                console.log(`💾 User offline presence updated: ${socket.userName}`);
            } catch (error) {
                console.error("Socket disconnect error:", error);
            }
        }
    });
});

/* ================= BASIC HEALTH CHECK ROUTE ================= */
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "🚀 Narlo Pure Socket Backend Running Fine"
    });
});

/* ================= SELF-PINGING TO KEEP RENDER AWAKE ================= */
const https = require("https");
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
    console.log(`⏱️ Self-pinging enabled for: ${RENDER_URL}`);
    // Ping every 10 minutes to reset Render's 15-minute inactivity timer
    setInterval(() => {
        https.get(RENDER_URL, (res) => {
            console.log(`📡 [Self-Ping] Ping sent to reset inactivity timer. Status Code: ${res.statusCode}`);
        }).on("error", (err) => {
            console.error(`❌ [Self-Ping] Error pinging server:`, err.message);
        });
    }, 10 * 60 * 1000); // 10 minutes
}

/* ================= LISTEN ON PORT ================= */
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});