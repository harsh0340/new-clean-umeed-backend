const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    salary: { type: String, default: "Negotiable" },
    experience: { type: String, default: "Any" },
    description: { type: String, default: "" },
    employer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    companyName: { type: String, default: "" },
    phone: { type: String, default: "" },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);
