require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// --- 🔐 Security Check: Validate Secrets ---
const requiredEnv = ['JWT_SECRET', 'GCP_PROJECT_ID', 'GCS_BUCKET_NAME'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL ERROR: Missing required secrets: ${missingEnv.join(', ')}`);
  console.error('👉 On Local: Check your .env file');
  console.error('👉 On Cloud Run: Check "Variables & Secrets" mapping from Secret Manager');
  process.exit(1);
}
// ------------------------------------------

// Middlewares
app.use(cors());
app.use(express.json());

// Import Routes
const sessionRoutes = require('./routes/sessionRoutes');
const metaRoutes = require('./routes/metaRoutes');
const formRoutes = require('./routes/formRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const validationRoutes = require('./routes/validationRoutes');
const documentRoutes = require('./routes/documentRoutes');

// API Versioning Base URL: /api/v1
const BASE_URL = '/api/v1';

app.use(`${BASE_URL}/session`, sessionRoutes);
app.use(`${BASE_URL}/departments`, metaRoutes); // Group 3: Metadata
app.use(`${BASE_URL}/forms`, formRoutes);       // Group 4: Form Info
app.use(`${BASE_URL}/upload`, uploadRoutes);    // Group 5: Upload
app.use(`${BASE_URL}/validation`, validationRoutes); // Group 6: Validation
app.use(`${BASE_URL}/documents`, documentRoutes);    // Group 7: Submission

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Student Request System API running on port ${PORT}`);
  console.log(`🔒 Security Mode: ${process.env.NODE_ENV === 'production' ? 'Production (Secret Manager)' : 'Development (.env)'}`);
});