const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, required: true, unique: true, trim: true, maxlength: 20 },
    city: { type: String, trim: true, maxlength: 100 },
    role: { type: String, enum: ["seeker", "employer", "admin"], default: "seeker" },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
