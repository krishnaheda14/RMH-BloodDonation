/**
 * Blood Donation Event Website - Server (Postgres)
 * Express.js backend using Postgres (pg)
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || null;

// Postgres pool (create only if DATABASE_URL provided)
let pool = null;
if (DATABASE_URL) {
    pool = new Pool({ connectionString: DATABASE_URL });
} else {
    console.warn('⚠️  No DATABASE_URL provided. Database features will be disabled.');
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
    if (req.method === 'POST') {
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

// Logo is now served from public/logo.png as static file

async function initDB() {
    try {
        if (!pool) {
            console.log('ℹ️  Skipping DB initialization because no pool is configured.');
            return;
        }

        await pool.query('SELECT 1');
        console.log('✅ Connected to Postgres successfully');

        // Ensure stats row exists
        await pool.query(
            `INSERT INTO stats (identifier, total_blood_units)
             VALUES ('global', 0)
             ON CONFLICT (identifier) DO NOTHING;`
        );

        console.log('✅ Stats row ensured');
    } catch (error) {
        console.error('❌ Postgres connection error:', error.message);
        // Do not exit the process in serverless/prod — keep server running and surface errors on API calls
    }
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
            configured: !!pool,
            url_present: !!DATABASE_URL,
            url_preview: DATABASE_URL ? DATABASE_URL.substring(0, 20) + '...' : 'NOT SET'
        },
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'not set',
            PORT: PORT,
            DEBUG: process.env.DEBUG || 'false'
        }
    };
    console.log('Health check:', JSON.stringify(health, null, 2));
    res.json(health);
});

app.post('/api/donate', async (req, res) => {
    console.log('\n=== /api/donate START ===');
    console.log('Step 1: Handler invoked');
    try {
        console.log('Step 2: Checking database pool...');
        if (!pool) {
            console.error('Step 2 FAILED: No database pool configured');
            return res.status(500).json({ success: false, message: 'Database not configured. Please set DATABASE_URL.' });
        }
        console.log('Step 2: Pool exists ✓');
        
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
            return res.status(400).json({ success: false, message: 'Donor must be at least 18 years old' });
        }
        console.log('Step 5: Age valid ✓', ageNum);

        console.log('Step 6: Validating blood group...');
        const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if (!validBloodGroups.includes(bloodGroup)) {
            console.error('Step 6 FAILED: Invalid blood group:', bloodGroup);
            return res.status(400).json({ success: false, message: 'Invalid blood group' });
        }
        console.log('Step 6: Blood group valid ✓');

        console.log('Step 7: Validating year...');
        const validYears = ['FY', 'SY', 'TY', 'Final Year'];
        if (!validYears.includes(year)) {
            console.error('Step 7 FAILED: Invalid year:', year);
            return res.status(400).json({ success: false, message: 'Invalid year selection' });
        }
        console.log('Step 7: Year valid ✓');

        // Insert donor into Postgres
        console.log('Step 8: Preparing database insert...');
        const insertText = `
            INSERT INTO donors (full_name, blood_group, age, year)
            VALUES ($1, $2, $3, $4)
            RETURNING id, full_name, blood_group, donated_at;
        `;
        console.log('Step 8: SQL:', insertText.trim());
        console.log('Step 8: Params:', [fullName.trim(), bloodGroup, ageNum, year]);
        
        console.log('Step 9: Executing insert query...');
        const insertResult = await pool.query(insertText, [fullName.trim(), bloodGroup, ageNum, year]);
        console.log('Step 9: Insert successful ✓');
        const donor = insertResult.rows[0];
        console.log('Step 10: Donor row returned:', donor);

        // Atomically increment stats
        console.log('Step 11: Updating stats...');
        const statsResult = await pool.query(
            `UPDATE stats SET total_blood_units = total_blood_units + 1, last_updated = NOW() WHERE identifier = 'global' RETURNING total_blood_units, last_updated;`
        );
        console.log('Step 11: Stats updated ✓');

        console.log('Step 12: Preparing response...');
        console.log(`🩸 New donor registered: ${fullName} (${bloodGroup})`);

        console.log('Step 13: Sending 201 response...');
        res.status(201).json({
            success: true,
            message: 'Donation registered successfully',
            data: {
                donor: {
                    fullName: donor.full_name,
                    bloodGroup: donor.blood_group
                },
                totalUnits: statsResult.rows[0].total_blood_units
            }
        });

        console.log('=== /api/donate SUCCESS ===\n');
    } catch (error) {
        console.error('\n=== /api/donate ERROR ===');
        console.error('Error occurred during donor registration');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Full stack:', error.stack);
        console.error('Error code (if DB):', error.code);
        console.error('Error detail (if DB):', error.detail);
        console.error('=========================\n');
        return respondError(res, 500, 'Server error. Please try again later.', error);
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        console.log('Entering /api/stats handler');
        if (!pool) return res.status(500).json({ success: false, message: 'Database not configured. Please set DATABASE_URL.' });
        const sql = `SELECT total_blood_units, last_updated FROM stats WHERE identifier = 'global' LIMIT 1;`;
        console.log('DB Stats Query:', sql);
        const result = await pool.query(sql);
        const stats = result.rows[0] || { total_blood_units: 0, last_updated: null };

        res.json({
            success: true,
            data: {
                totalBloodUnits: parseInt(stats.total_blood_units, 10),
                lastUpdated: stats.last_updated
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error && error.stack ? error.stack : error);
        return respondError(res, 500, 'Error fetching statistics', error);
    }
});

app.post('/api/sync-stats', async (req, res) => {
    try {
        console.log('Entering /api/sync-stats handler');
        if (!pool) return res.status(500).json({ success: false, message: 'Database not configured. Please set DATABASE_URL.' });
        const countSql = 'SELECT COUNT(*)::int AS cnt FROM donors;';
        console.log('DB Count Query:', countSql);
        const countRes = await pool.query(countSql);
        const donorCount = countRes.rows[0].cnt;

        await pool.query(
            `UPDATE stats SET total_blood_units = $1, last_updated = NOW() WHERE identifier = 'global';`,
            [donorCount]
        );

        res.json({ success: true, message: `Stats synced. Total donors: ${donorCount}`, data: { totalBloodUnits: donorCount } });
    } catch (error) {
        console.error('Error syncing stats:', error && error.stack ? error.stack : error);
        return respondError(res, 500, 'Error syncing statistics', error);
    }
});

app.get('/api/donors', async (req, res) => {
    try {
        console.log('Entering /api/donors handler, query:', req.query);
        if (!pool) return res.status(500).json({ success: false, message: 'Database not configured. Please set DATABASE_URL.' });
        const limit = parseInt(req.query.limit) || 10;
        const donorsSql = `
            SELECT full_name AS "fullName", blood_group AS "bloodGroup", donated_at AS "donatedAt"
             FROM donors
             ORDER BY donated_at DESC
             LIMIT $1;`;
        console.log('DB Donors Query:', donorsSql.trim(), 'Params:', [limit]);
        const donorsRes = await pool.query(donorsSql, [limit]);

        res.json({ success: true, data: donorsRes.rows });
    } catch (error) {
        console.error('Error fetching donors:', error && error.stack ? error.stack : error);
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
    await initDB();

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

startServer();

// Global error handlers for debugging
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason && reason.stack ? reason.stack : reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});
