const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Job = require("./models/Job");
const Application = require("./models/Application");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Database
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err.message));

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, service: "Umeed Backend", message: "API is running" });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "umeed-backend" });
});

// Get jobs with optional search, city and category filters.
app.get("/api/jobs", async (req, res) => {
  try {
    const { search, city, category, limit = 50 } = req.query;
    const filter = { isActive: true };

    if (city) filter.city = new RegExp(`^${escapeRegex(city.trim())}$`, "i");
    if (category) filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, "i");

    if (search && search.trim()) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { title: new RegExp(q, "i") },
        { company: new RegExp(q, "i") },
        { description: new RegExp(q, "i") },
      ];
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 100));

    res.json({ success: true, count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch jobs" });
  }
});

// Get one job.
app.get("/api/jobs/:id", async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, isActive: true });
    if (!job) return res.status(404).json({ success: false, error: "Job not found" });
    res.json({ success: true, job });
  } catch (error) {
    res.status(400).json({ success: false, error: "Invalid job ID" });
  }
});

// Post a job. Authentication/OTP protection will be added before public launch.
app.post("/api/jobs", async (req, res) => {
  try {
    const { title, company, category, city } = req.body;
    if (!title || !company || !category || !city) {
      return res.status(400).json({
        success: false,
        error: "title, company, category and city are required",
      });
    }

    const job = await Job.create(req.body);
    res.status(201).json({ success: true, job });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Apply for a job.
app.post("/api/jobs/:id/apply", async (req, res) => {
  try {
    const { name, phone, city, experience, expectedSalary } = req.body;
    if (!name || !phone || !city) {
      return res.status(400).json({
        success: false,
        error: "name, phone and city are required",
      });
    }

    const job = await Job.findOne({ _id: req.params.id, isActive: true });
    if (!job) return res.status(404).json({ success: false, error: "Job not found" });

    const application = await Application.create({
      job: job._id,
      name,
      phone,
      city,
      experience,
      expectedSalary,
    });

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      applicationId: application._id,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create/update a basic user profile. OTP verification will be wired to an SMS provider later.
app.post("/api/users", async (req, res) => {
  try {
    const { name, phone, city, role = "seeker" } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: "phone is required" });

    const user = await User.findOneAndUpdate(
      { phone },
      { name, phone, city, role },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

app.listen(PORT, () => {
  console.log(`Umeed Backend running on port ${PORT}`);
});
