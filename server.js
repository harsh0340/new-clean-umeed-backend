const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const twilio = require("twilio");
require("dotenv").config();

const Job = require("./models/Job");
const Application = require("./models/Application");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5000;
app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_URL || "").split(",").map((url) => url.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
}));
app.use(express.json({ limit: "1mb" }));

const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false, message: { success: false, error: "Too many requests. Please try again later." } });
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false, message: { success: false, error: "Too many OTP requests. Please try again later." } });

const twilioReady = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
const twilioClient = twilioReady ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

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

app.post("/api/users", writeLimiter, async (req, res) => {
  try {
    const { name, phone, city, role = "seeker" } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: "phone is required" });
    const normalized = normalizePhone(phone);
    if (!normalized) return res.status(400).json({ success: false, error: "Enter a valid 10-digit mobile number" });
    const user = await User.findOneAndUpdate({ phone: { $in: [phone, normalized] } }, { name, phone: normalized, city, role }, { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true });
    res.status(200).json({ success: true, user });
  } catch (error) { res.status(400).json({ success: false, error: error.message }); }
});

function normalizePhone(phone) {
  const value = String(phone || "").replace(/\s+/g, "").trim();
  if (/^\+\d{10,15}$/.test(value)) return value;
  if (/^91\d{10}$/.test(value)) return `+${value}`;
  if (/^\d{10}$/.test(value)) return `+91${value}`;
  return null;
}

app.post("/api/auth/send-otp", otpLimiter, async (req, res) => {
  console.log("OTP request received for mobile login");
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ success: false, error: "Enter a valid 10-digit mobile number" });
    if (!twilioReady) return res.status(503).json({ success: false, error: "SMS OTP service is not configured yet" });

    const user = await User.findOne({ phone: { $in: [phone, phone.replace(/^\+91/, "")] } });
    if (!user) return res.status(404).json({ success: false, error: "Mobile number is not registered" });

    const verification = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ channel: "sms", to: phone });

    console.log("Twilio Verify accepted:", verification.sid, verification.status);
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP send error:", error.message);
    res.status(500).json({ success: false, error: "OTP could not be sent. Please try again." });
  }
});

app.post("/api/auth/verify-otp", otpLimiter, async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();
    if (!phone || !/^\d{6}$/.test(otp)) return res.status(400).json({ success: false, error: "Enter a valid 6-digit OTP" });
    if (!twilioReady) return res.status(503).json({ success: false, error: "SMS OTP service is not configured yet" });

    const user = await User.findOne({ phone: { $in: [phone, phone.replace(/^\+91/, "")] } }).select("name phone city role isVerified");
    if (!user) return res.status(404).json({ success: false, error: "User not found. Please register first." });

    const verificationCheck = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ code: otp, to: phone });

    if (verificationCheck.status !== "approved") return res.status(400).json({ success: false, error: "Invalid OTP" });

    user.isVerified = true;
    await user.save();
    res.json({ success: true, message: "Login successful", user });
  } catch (error) {
    console.error("OTP verify error:", error.message);
    res.status(400).json({ success: false, error: "Invalid or expired OTP" });
  }
});

app.use((req, res) => res.status(404).json({ success: false, error: "Endpoint not found" }));
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
app.listen(PORT, () => console.log(`Umeed Backend running on port ${PORT}`));
