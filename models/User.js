const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20, sparse: true, unique: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 200, sparse: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    city: { type: String, trim: true, maxlength: 100 },
    role: { type: String, enum: ["seeker", "employer", "admin"], default: "seeker" },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
