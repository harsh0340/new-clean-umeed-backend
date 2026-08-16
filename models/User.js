const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    city: { type: String, required: true, trim: true },
    role: { type: String, enum: ["seeker", "employer"], required: true },
    category: { type: String, default: "" },
    experience: { type: String, default: "" },
    expectedSalary: { type: String, default: "" },
    companyName: { type: String, default: "" },
    profileImage: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
