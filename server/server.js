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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

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

app.post('/api/donate', async (req, res) => {
    try {
        if (!pool) return res.status(500).json({ success: false, message: 'Database not configured. Please set DATABASE_URL.' });
        const { fullName, bloodGroup, age, year } = req.body;

        // Server-side validation
        if (!fullName || !bloodGroup || !age || !year) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 18) {
            return res.status(400).json({ success: false, message: 'Donor must be at least 18 years old' });
        }

        const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if (!validBloodGroups.includes(bloodGroup)) {
            return res.status(400).json({ success: false, message: 'Invalid blood group' });
        }

        const validYears = ['FY', 'SY', 'TY', 'Final Year'];
        if (!validYears.includes(year)) {
            return res.status(400).json({ success: false, message: 'Invalid year selection' });
        }

        // Insert donor into Postgres
        const insertText = `
            INSERT INTO donors (full_name, blood_group, age, year)
            VALUES ($1, $2, $3, $4)
            RETURNING id, full_name, blood_group, donated_at;
        `;

        const insertResult = await pool.query(insertText, [fullName.trim(), bloodGroup, ageNum, year]);
        const donor = insertResult.rows[0];

        // Atomically increment stats
        const statsResult = await pool.query(
            `UPDATE stats SET total_blood_units = total_blood_units + 1, last_updated = NOW() WHERE identifier = 'global' RETURNING total_blood_units, last_updated;`
        );

        console.log(`🩸 New donor registered: ${fullName} (${bloodGroup})`);

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

    } catch (error) {
        console.error('Error registering donor:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        if (!pool) return res.status(500).json({ success: false, message: 'Database not configured. Please set DATABASE_URL.' });
        const result = await pool.query(`SELECT total_blood_units, last_updated FROM stats WHERE identifier = 'global' LIMIT 1;`);
        const stats = result.rows[0] || { total_blood_units: 0, last_updated: null };

        res.json({
            success: true,
            data: {
                totalBloodUnits: parseInt(stats.total_blood_units, 10),
                lastUpdated: stats.last_updated
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching statistics' });
    }
});

app.post('/api/sync-stats', async (req, res) => {
    try {
        if (!pool) return res.status(500).json({ success: false, message: 'Database not configured. Please set DATABASE_URL.' });
        const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM donors;');
        const donorCount = countRes.rows[0].cnt;

        await pool.query(
            `UPDATE stats SET total_blood_units = $1, last_updated = NOW() WHERE identifier = 'global';`,
            [donorCount]
        );

        res.json({ success: true, message: `Stats synced. Total donors: ${donorCount}`, data: { totalBloodUnits: donorCount } });
    } catch (error) {
        console.error('Error syncing stats:', error);
        res.status(500).json({ success: false, message: 'Error syncing statistics' });
    }
});

app.get('/api/donors', async (req, res) => {
    try {
        if (!pool) return res.status(500).json({ success: false, message: 'Database not configured. Please set DATABASE_URL.' });
        const limit = parseInt(req.query.limit) || 10;
        const donorsRes = await pool.query(
            `SELECT full_name AS "fullName", blood_group AS "bloodGroup", donated_at AS "donatedAt"
             FROM donors
             ORDER BY donated_at DESC
             LIMIT $1;`,
            [limit]
        );

        res.json({ success: true, data: donorsRes.rows });
    } catch (error) {
        console.error('Error fetching donors:', error);
        res.status(500).json({ success: false, message: 'Error fetching donors' });
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
