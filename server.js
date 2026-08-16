const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const User = require("./models/User");
const Job = require("./models/Job");
const Application = require("./models/Application");

const app = express();
app.use(express.json());
app.use(cors());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

app.get("/", (req, res) => {
  res.json({ name: "Umeed", message: "Umeed Backend is running successfully!", status: "ok" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "umeed-backend" });
});

// Register/update a basic seeker or employer profile.
app.post("/users", async (req, res) => {
  try {
    const { name, phone, city, role } = req.body;
    if (!name || !phone || !city || !role) {
      return res.status(400).json({ error: "name, phone, city and role are required" });
    }
    if (!["seeker", "employer"].includes(role)) {
      return res.status(400).json({ error: "role must be seeker or employer" });
    }

    const user = await User.findOneAndUpdate(
      { phone },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to save user", details: error.message });
  }
});

app.get("/users/:phone", async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phone });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Public job search. Supports city/category/text filters.
app.get("/jobs", async (req, res) => {
  try {
    const { city, category, q } = req.query;
    const filter = { active: true };
    if (city) filter.city = new RegExp(`^${String(city).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, "i");
    if (category) filter.category = new RegExp(String(category).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i");
    if (q) {
      const safe = String(q).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
      filter.$or = [
        { title: new RegExp(safe, "i") },
        { category: new RegExp(safe, "i") },
        { description: new RegExp(safe, "i") },
        { companyName: new RegExp(safe, "i") }
      ];
    }
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

app.get("/jobs/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) {
    res.status(400).json({ error: "Invalid job id" });
  }
});

// Employer creates a job listing.
app.post("/jobs", async (req, res) => {
  try {
    const { title, category, city } = req.body;
    if (!title || !category || !city) {
      return res.status(400).json({ error: "title, category and city are required" });
    }
    const job = await Job.create(req.body);
    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: "Failed to create job", details: error.message });
  }
});

// Apply for a job.
app.post("/applications", async (req, res) => {
  try {
    const { job, name, phone, city } = req.body;
    if (!job || !name || !phone || !city) {
      return res.status(400).json({ error: "job, name, phone and city are required" });
    }
    const application = await Application.create(req.body);
    res.status(201).json({ message: "Application submitted successfully", application });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit application", details: error.message });
  }
});

// Backward-compatible endpoint for the existing frontend.
app.post("/apply", async (req, res) => {
  try {
    const { job, name, phone, city, experience, salary } = req.body;
    if (!job || !name || !phone || !city) {
      return res.status(400).json({ error: "job, name, phone and city are required" });
    }
    const application = await Application.create({ job, name, phone, city, experience, salary });
    res.status(201).json({ message: "Application submitted successfully", application });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit application", details: error.message });
  }
});

app.get("/applications", async (req, res) => {
  try {
    const filter = {};
    if (req.query.phone) filter.phone = req.query.phone;
    if (req.query.job) filter.job = req.query.job;
    const applications = await Application.find(filter).populate("job", "title category city").sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Umeed Backend running on port ${PORT}`));
