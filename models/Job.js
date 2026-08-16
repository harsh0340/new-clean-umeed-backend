const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "Driver",
        "Helper",
        "Cook",
        "Security Guard",
        "Shop Helper",
        "Accountant",
        "Computer Operator",
        "Salesman",
        "Other",
      ],
    },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    salary: { type: String, trim: true, maxlength: 100 },
    experience: { type: String, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000 },
    phone: { type: String, trim: true, maxlength: 20 },
    address: { type: String, trim: true, maxlength: 300 },
    shopImage: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

jobSchema.index({ city: 1, category: 1, isActive: 1 });
jobSchema.index({ title: "text", company: "text", description: "text" });

module.exports = mongoose.model("Job", jobSchema);
