import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
  jobId: String,
  name: String,
  mobile: String,
  city: String,
  appliedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Application", applicationSchema);
