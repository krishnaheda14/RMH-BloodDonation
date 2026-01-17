/**
 * Blood Donation Event Website - Server (MongoDB)
 * Express.js backend using MongoDB Atlas
 */

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;

// Load environment variables from .env during development (optional).
// Wrap in try/catch so absence of the `dotenv` package doesn't crash production.
try {
    if (process.env.NODE_ENV !== 'production') {
        require('dotenv').config();
    }
} catch (e) {
    // dotenv not installed or failed to load — ignore in production environments
}

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
let mongoClient = null;
let mongoDB = null;
let donorsCollection = null;
let statsCollection = null;

async function initMongo() {
    try {
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI not provided. Database will not work.');
            return;
        }
        
        console.log('🔄 Connecting to MongoDB Atlas...');
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        
        // Get database (from URI or default to 'blood_donation')
        mongoDB = mongoClient.db();
        donorsCollection = mongoDB.collection('donors');
        statsCollection = mongoDB.collection('stats');

        console.log('✅ Connected to MongoDB Atlas successfully');

        // Ensure stats document exists with initial value
        const statsDoc = await statsCollection.findOne({ identifier: 'global' });
        if (!statsDoc) {
            await statsCollection.insertOne({
                identifier: 'global',
                total_blood_units: 0,
                last_updated: new Date()
            });
            console.log('✅ Created initial stats document');
        } else {
            console.log('✅ Stats document exists');
        }
        
        // Create indexes for performance
        await donorsCollection.createIndex({ donatedAt: -1 });
        await donorsCollection.createIndex({ bloodGroup: 1 });
        console.log('✅ Database indexes created');
        
    } catch (e) {
        console.error('❌ MongoDB initialization error:', e.message);
        console.error('Stack:', e.stack);
        // Keep server running; surface errors on API calls
    }
}

async function shutdownMongo() {
    try {
        if (mongoClient) {
            await mongoClient.close();
            console.log('MongoDB connection closed');
        }
    } catch (e) {
        console.error('Error closing MongoDB:', e.message);
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger for debugging
app.use((req, res, next) => {
    const now = new Date().toISOString();
    console.log(`[${now}] --> ${req.method} ${req.originalUrl} from ${req.ip}`);
    // capture body for POST requests (avoid logging in production)
    if (req.method === 'POST' && process.env.DEBUG === 'true') {
        try {
            console.log('     Body:', JSON.stringify(req.body));
        } catch (e) {
            console.log('     Body: (could not stringify)');
        }
    }
    // hook into response finish to log status
    res.on('finish', () => {
        console.log(`[${now}] <-- ${req.method} ${req.originalUrl} ${res.statusCode}`);
    });
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Helper to send errors with optional debug info (enable by setting DEBUG=true)
function respondError(res, status, userMessage, error) {
    const payload = { success: false, message: userMessage };
    if (process.env.DEBUG === 'true' && error) {
        payload._debug = {
            message: error.message || String(error),
            stack: error.stack || null
        };
    }
    return res.status(status).json(payload);
}

// ============================================
// API ROUTES
// ============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    const health = {
        status: 'running',
        timestamp: new Date().toISOString(),
        database: {
            type: 'MongoDB Atlas',
            configured: !!mongoClient,
            connected: !!mongoDB,
            collections: {
                donors: !!donorsCollection,
                stats: !!statsCollection
            }
        },
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            PORT: PORT,
            DEBUG: process.env.DEBUG || 'false'
        }
    };
    console.log('Health check:', JSON.stringify(health, null, 2));
    res.json(health);
});

// Donate endpoint - register new donor
app.post('/api/donate', async (req, res) => {
    console.log('\n=== /api/donate START ===');
    console.log('Step 1: Handler invoked');
    
    try {
        console.log('Step 2: Checking MongoDB connection...');
        if (!donorsCollection || !statsCollection) {
            console.error('Step 2 FAILED: MongoDB not connected');
            return res.status(500).json({ 
                success: false, 
                message: 'Database not configured. Please contact administrator.' 
            });
        }
        console.log('Step 2: MongoDB connected ✓');
        
        console.log('Step 3: Extracting request body...');
        const { fullName, bloodGroup, age, year } = req.body;
        console.log('Step 3: Body extracted ✓', { fullName, bloodGroup, age, year });

        // Server-side validation
        console.log('Step 4: Validating required fields...');
        if (!fullName || !bloodGroup || !age || !year) {
            console.error('Step 4 FAILED: Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        console.log('Step 4: Required fields valid ✓');

        console.log('Step 5: Validating age...');
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 18) {
            console.error('Step 5 FAILED: Invalid age:', age);
            return res.status(400).json({ 
                success: false, 
                message: 'Donor must be at least 18 years old' 
            });
        }
        console.log('Step 5: Age valid ✓', ageNum);

        console.log('Step 6: Validating blood group...');
        const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if (!validBloodGroups.includes(bloodGroup)) {
            console.error('Step 6 FAILED: Invalid blood group:', bloodGroup);
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid blood group' 
            });
        }
        console.log('Step 6: Blood group valid ✓');

        console.log('Step 7: Validating year...');
        const validYears = ['FY', 'SY', 'TY', 'Final Year'];
        if (!validYears.includes(year)) {
            console.error('Step 7 FAILED: Invalid year:', year);
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid year selection' 
            });
        }
        console.log('Step 7: Year valid ✓');

        // Insert donor into MongoDB
        console.log('Step 8: Inserting donor into MongoDB...');
        const donorDoc = {
            fullName: fullName.trim(),
            bloodGroup,
            age: ageNum,
            year,
            donatedAt: new Date()
        };
        
        const result = await donorsCollection.insertOne(donorDoc);
        console.log('Step 9: Insert successful ✓', result.insertedId);

        // Update stats atomically
        console.log('Step 10: Updating MongoDB stats...');
        const statsRes = await statsCollection.findOneAndUpdate(
            { identifier: 'global' },
            { 
                $inc: { total_blood_units: 1 }, 
                $set: { last_updated: new Date() } 
            },
            { 
                returnDocument: 'after', 
                upsert: true 
            }
        );
        
        const totalUnits = statsRes.value ? statsRes.value.total_blood_units : 1;
        console.log('Step 10: MongoDB stats updated ✓', { totalUnits });

        console.log('Step 11: Preparing response...');
        console.log(`🩸 New donor registered: ${fullName.trim()} (${bloodGroup})`);

        console.log('Step 12: Sending 201 response...');
        res.status(201).json({
            success: true,
            message: 'Donation registered successfully',
            data: {
                donor: {
                    fullName: fullName.trim(),
                    bloodGroup: bloodGroup
                },
                totalUnits: totalUnits
            }
        });

        console.log('=== /api/donate SUCCESS ===\n');
        
    } catch (error) {
        console.error('\n=== /api/donate ERROR ===');
        console.error('Error occurred during donor registration');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Full stack:', error.stack);
        console.error('=========================\n');
        return respondError(res, 500, 'Server error. Please try again later.', error);
    }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
    try {
        console.log('Entering /api/stats handler');
        
        if (!statsCollection) {
            return res.status(500).json({ 
                success: false, 
                message: 'Database not configured' 
            });
        }
        
        const doc = await statsCollection.findOne({ identifier: 'global' });
        const total = doc ? parseInt(doc.total_blood_units || 0, 10) : 0;
        const lastUpdated = doc ? doc.last_updated : null;
        
        console.log('Stats fetched:', { total, lastUpdated });
        
        res.json({ 
            success: true, 
            data: { 
                totalBloodUnits: total, 
                lastUpdated: lastUpdated 
            } 
        });
        
    } catch (error) {
        console.error('Error fetching stats:', error.stack);
        return respondError(res, 500, 'Error fetching statistics', error);
    }
});

// Sync stats (recount from donors collection)
app.post('/api/sync-stats', async (req, res) => {
    try {
        console.log('Entering /api/sync-stats handler');
        
        if (!donorsCollection || !statsCollection) {
            return res.status(500).json({ 
                success: false, 
                message: 'Database not configured' 
            });
        }
        
        const donorCount = await donorsCollection.countDocuments();
        console.log('Total donors counted:', donorCount);
        
        await statsCollection.updateOne(
            { identifier: 'global' },
            { 
                $set: { 
                    total_blood_units: donorCount, 
                    last_updated: new Date() 
                } 
            },
            { upsert: true }
        );
        
        console.log('Stats synced successfully');
        
        res.json({ 
            success: true, 
            message: `Stats synced. Total donors: ${donorCount}`, 
            data: { totalBloodUnits: donorCount } 
        });
        
    } catch (error) {
        console.error('Error syncing stats:', error.stack);
        return respondError(res, 500, 'Error syncing statistics', error);
    }
});

// Get recent donors
app.get('/api/donors', async (req, res) => {
    try {
        console.log('Entering /api/donors handler, query:', req.query);
        
        if (!donorsCollection) {
            return res.status(500).json({ 
                success: false, 
                message: 'Database not configured' 
            });
        }
        
        const limit = parseInt(req.query.limit) || 10;
        console.log('Fetching donors with limit:', limit);
        
        const docs = await donorsCollection
            .find()
            .sort({ donatedAt: -1 })
            .limit(limit)
            .toArray();
        
        const mapped = docs.map(d => ({ 
            fullName: d.fullName, 
            bloodGroup: d.bloodGroup, 
            donatedAt: d.donatedAt 
        }));
        
        console.log(`Fetched ${mapped.length} donors`);
        
        res.json({ success: true, data: mapped });
        
    } catch (error) {
        console.error('Error fetching donors:', error.stack);
        return respondError(res, 500, 'Error fetching donors', error);
    }
});

// ============================================
// PAGE ROUTES
// ============================================

// Serve registration page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve thank you page
app.get('/thank-you', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/thankyou.html'));
});

// Serve dashboard page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
    await initMongo();

    app.listen(PORT, () => {
        console.log('========================================');
        console.log('🩸 Blood Donation Event Website');
        console.log('========================================');
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📝 Registration: http://localhost:${PORT}/`);
        console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
        console.log('========================================');
    });
}

// If run directly (node server/server.js), start the local server.
if (require.main === module) {
    startServer();
}

// Export a Vercel-compatible serverless handler and the express `app`.
// Export handler at top-level so Vercel detects exports even if initialization is delayed.
module.exports = async function vercelHandler(req, res) {
    try {
        if (!mongoClient) {
            await initMongo();
        }
        return app(req, res);
    } catch (e) {
        console.error('Error in serverless handler init:', e && e.stack ? e.stack : e);
        return respondError(res, 500, 'Server error during initialization', e);
    }
};

// Also provide the raw express app for other hosting environments
module.exports.app = app;

// Global error handlers for debugging
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason && reason.stack ? reason.stack : reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await shutdownMongo();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await shutdownMongo();
    process.exit(0);
});
