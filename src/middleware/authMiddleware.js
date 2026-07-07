const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(" ")[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "narlo_super_secret_key_2026");

            // Get user from token and exclude password
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "User not found, authorization failed",
                });
            }

            next();
        } catch (error) {
            console.error("Auth Middleware Error:", error);
            return res.status(401).json({
                success: false,
                message: "Not authorized, token failed",
            });
        }
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Not authorized, no token",
        });
    }
};

module.exports = { protect };
