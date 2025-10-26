import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import Application from "./models/Application.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected ✅"))
.catch((err) => console.error(err));

app.post("/apply", async (req, res) => {
  try {
    const { jobId, name, mobile, city } = req.body;
    const newApp = new Application({ jobId, name, mobile, city });
    await newApp.save();
    res.json({ success: true, message: "Application submitted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/applications/:jobId", async (req, res) => {
  try {
    const apps = await Application.find({ jobId: req.params.jobId });
    res.json(apps);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
