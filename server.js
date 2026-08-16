const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
require("dotenv").config();

const Job = require("./models/Job");
const Application = require("./models/Application");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5000;
app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map((url) => url.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, methods: ["GET", "POST", "PATCH", "OPTIONS"] }));
app.use(express.json({ limit: "1mb" }));

const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false, message: { success: false, error: "Too many requests. Please try again later." } });
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false, message: { success: false, error: "Too many OTP requests. Please try again later." } });
const otpStore = new Map();

mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB Connected")).catch((err) => console.error("MongoDB Connection Error:", err.message));

app.get("/", (req, res) => res.json({ ok: true, service: "Umeed Backend", message: "API is running" }));
app.get("/api/health", (req, res) => res.json({ ok: mongoose.connection.readyState === 1, service: "umeed-backend", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));

app.get("/api/jobs", async (req, res) => {
  try {
    const { search, city, category, limit = 50 } = req.query;
    const filter = { isActive: true };
    if (city) filter.city = new RegExp(`^${escapeRegex(city.trim())}$`, "i");
    if (category) filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, "i");
    if (search && search.trim()) {
      const q = escapeRegex(search.trim());
      filter.$or = [{ title: new RegExp(q, "i") }, { company: new RegExp(q, "i") }, { description: new RegExp(q, "i") }];
    }
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 50, 100));
    res.json({ success: true, count: jobs.length, jobs });
  } catch { res.status(500).json({ success: false, error: "Failed to fetch jobs" }); }
});

app.get("/api/jobs/:id", async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, isActive: true });
    if (!job) return res.status(404).json({ success: false, error: "Job not found" });
    res.json({ success: true, job });
  } catch { res.status(400).json({ success: false, error: "Invalid job ID" }); }
});

app.post("/api/jobs", writeLimiter, async (req, res) => {
  try {
    const { title, company, category, city } = req.body;
    if (!title || !company || !category || !city) return res.status(400).json({ success: false, error: "title, company, category and city are required" });
    const job = await Job.create(req.body);
    res.status(201).json({ success: true, job });
  } catch (error) { res.status(400).json({ success: false, error: error.message }); }
});

app.post("/api/jobs/:id/apply", writeLimiter, async (req, res) => {
  try {
    const { name, phone, city, experience, expectedSalary } = req.body;
    if (!name || !phone || !city) return res.status(400).json({ success: false, error: "name, phone and city are required" });
    const job = await Job.findOne({ _id: req.params.id, isActive: true });
    if (!job) return res.status(404).json({ success: false, error: "Job not found" });
    const application = await Application.create({ job: job._id, name, phone, city, experience, expectedSalary });
    res.status(201).json({ success: true, message: "Application submitted successfully", applicationId: application._id });
  } catch (error) { res.status(400).json({ success: false, error: error.message }); }
});

// Basic profile creation. SMS provider can be plugged into sendOtp() later.
app.post("/api/users", writeLimiter, async (req, res) => {
  try {
    const { name, phone, city, role = "seeker" } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: "phone is required" });
    const user = await User.findOneAndUpdate({ phone }, { name, phone, city, role }, { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true });
    res.status(200).json({ success: true, user });
  } catch (error) { res.status(400).json({ success: false, error: error.message }); }
});

// OTP login flow. For now the OTP is logged by Render for testing; connect an SMS provider before public launch.
app.post("/api/auth/send-otp", otpLimiter, async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    const mode = req.body.mode === "login" ? "login" : "register";
    if (!phone) return res.status(400).json({ success: false, error: "phone is required" });
    if (mode === "login") {
      const user = await User.findOne({ phone });
      if (!user) return res.status(404).json({ success: false, error: "Mobile number is not registered" });
    }
    const otp = String(crypto.randomInt(100000, 1000000));
    otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000, mode });
    console.log(`[Umeed OTP] ${phone}: ${otp}`);
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post("/api/auth/verify-otp", otpLimiter, async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    const otp = String(req.body.otp || "").trim();
    const record = otpStore.get(phone);
    if (!record || record.expiresAt < Date.now() || record.otp !== otp) return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    otpStore.delete(phone);
    const user = await User.findOneAndUpdate({ phone }, { isVerified: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, error: "User not found. Please register first." });
    res.json({ success: true, message: "Login successful", user });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.use((req, res) => res.status(404).json({ success: false, error: "Endpoint not found" }));
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
app.listen(PORT, () => console.log(`Umeed Backend running on port ${PORT}`));
