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
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
}));
app.use(express.json({ limit: "1mb" }));

const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false, message: { success: false, error: "Too many requests. Please try again later." } });

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

function normalizePhone(phone) {
  const value = String(phone || "").replace(/\s+/g, "").trim();
  if (/^\+\d{10,15}$/.test(value)) return value;
  if (/^91\d{10}$/.test(value)) return `+${value}`;
  if (/^\d{10}$/.test(value)) return `+91${value}`;
  return null;
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, key] = String(stored || "").split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedKey = Buffer.from(key, "hex");
  return storedKey.length === derived.length && crypto.timingSafeEqual(storedKey, derived);
}

app.post("/api/users", writeLimiter, async (req, res) => {
  try {
    const { name, phone, email, password, city, role = "seeker" } = req.body;
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    const normalizedEmail = email ? normalizeEmail(email) : null;
    if (!normalizedPhone && !normalizedEmail) return res.status(400).json({ success: false, error: "Mobile number ya valid Email ID mein se koi ek zaroori hai" });
    if (!name || !city) return res.status(400).json({ success: false, error: "Name and city are required" });
    if (!password || String(password).length < 6) return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });

    const existing = await User.findOne({ $or: [normalizedPhone ? { phone: normalizedPhone } : null, normalizedEmail ? { email: normalizedEmail } : null].filter(Boolean) });
    if (existing) return res.status(409).json({ success: false, error: "Mobile number or Email ID is already registered" });

    const user = await User.create({ name: name.trim(), phone: normalizedPhone || undefined, email: normalizedEmail || undefined, passwordHash: hashPassword(String(password)), city: city.trim(), role, isVerified: false });
    res.status(201).json({ success: true, message: "Registration successful! Umeed account create ho gaya.", user: { id: user._id, name: user.name, phone: user.phone, email: user.email, city: user.city, role: user.role } });
  } catch (error) { res.status(400).json({ success: false, error: error.message }); }
});

app.post("/api/auth/login", writeLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, error: "Mobile/Email and password are required" });
    const normalizedPhone = normalizePhone(identifier);
    const normalizedEmail = normalizeEmail(identifier);
    const query = normalizedPhone ? { phone: normalizedPhone } : normalizedEmail ? { email: normalizedEmail } : null;
    if (!query) return res.status(400).json({ success: false, error: "Enter a valid mobile number or Email ID" });
    const user = await User.findOne(query).select("+passwordHash name phone email city role isVerified");
    if (!user || !verifyPassword(String(password), user.passwordHash)) return res.status(401).json({ success: false, error: "Invalid mobile/email or password" });
    res.json({ success: true, message: "Login successful!", user: { id: user._id, name: user.name, phone: user.phone, email: user.email, city: user.city, role: user.role } });
  } catch (error) { res.status(500).json({ success: false, error: "Login failed. Please try again." }); }
});

app.use((req, res) => res.status(404).json({ success: false, error: "Endpoint not found" }));
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
app.listen(PORT, () => console.log(`Umeed Backend running on port ${PORT}`));
