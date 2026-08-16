const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    experience: { type: String, trim: true, maxlength: 500 },
    expectedSalary: { type: String, trim: true, maxlength: 100 },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "rejected", "hired"],
      default: "applied",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", applicationSchema);
