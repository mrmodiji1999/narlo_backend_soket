const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        console.log("Connecting to MongoDB...");
        if (!process.env.MONGO_URI) {
            console.error("❌ MONGO_URI environment variable is not defined!");
            process.exit(1);
        }
        console.log(
            process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:********@")
        );

        await mongoose.connect(process.env.MONGO_URI);

        console.log("✅ MongoDB Connected");
    } catch (error) {
        console.error("❌ MongoDB Connection Failed");
        console.error(error); // Full error object
        process.exit(1);
    }
};

module.exports = connectDB;