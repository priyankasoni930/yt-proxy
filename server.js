const express = require("express");
const { getSubtitles } = require("youtube-captions-scraper");
const app = express();
const PORT = process.env.PORT || 3004;

// Middleware for CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Rate limiting middleware
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Main transcript route
app.get("/transcript", async (req, res) => {
  const videoId = req.query.videoId;

  if (!videoId) {
    return res.status(400).json({
      error: "Video ID is required",
      example: "/transcript?videoId=dQw4w9WgXcQ",
    });
  }

  try {
    const transcript = await fetchTranscript(videoId);
    res.json({
      videoId,
      transcript,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching transcript:", error);

    let statusCode = 500;
    let message = "Failed to fetch transcript";

    if (error.message.includes("Could not find captions")) {
      statusCode = 404;
      message = "English transcript not found for this video";
    }

    res.status(statusCode).json({
      error: message,
      videoId,
    });
  }
});

// Transcript fetching function
const fetchTranscript = async (videoId) => {
  try {
    const captions = await getSubtitles({
      videoID: videoId,
      lang: "en", // Hardcoded to English
    });

    return captions.map((caption) => ({
      text: caption.text,
      start: caption.start,
      duration: caption.dur,
      timestamp: formatTimestamp(caption.start),
    }));
  } catch (error) {
    console.error(`Failed to fetch transcript for video ${videoId}:`, error);
    throw error;
  }
};

// Helper function to format timestamps
const formatTimestamp = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
