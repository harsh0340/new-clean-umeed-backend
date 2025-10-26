const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// Example route (homepage check)
app.get("/", (req, res) => {
    res.send("🚀 Umeed Backend is running successfully!");
});

// Import Models
const Application = require("./models/Application");

// Example API endpoint (Job Application)
app.post("/apply", async (req, res) => {
    try {
        const { name, phone, city, jobCategory, experience, salary } = req.body;

        const newApp = new Application({
            name,
            phone,
            city,
            jobCategory,
            experience,
            salary
        });

        await newApp.save();
        res.status(201).json({ message: "✅ Application submitted successfully" });
    } catch (error) {
        res.status(500).json({ error: "❌ Failed to submit application" });
    }
});

// Port (Render will assign automatically)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

