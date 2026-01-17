/**
 * Database Connection Test
 * Tests actual PostgreSQL connection to Supabase
 */

const { Client } = require('pg');

// Use environment variable or fallback
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:PHBXsQjLfePb3jo4@db.lwgnhieekdjtnvpxqull.supabase.co:5432/postgres';

async function testConnection() {
    console.log('=== Database Connection Test ===\n');
    
    // Parse connection string
    try {
        const url = new URL(DATABASE_URL.replace('postgresql://', 'http://'));
        console.log('Connection Details:');
        console.log('  Host:', url.hostname);
        console.log('  Port:', url.port || 5432);
        console.log('  Database:', url.pathname.slice(1) || 'postgres');
        console.log('  User:', url.username);
        console.log('  Password:', url.password ? '***' + url.password.slice(-4) : 'NOT SET');
        console.log();
    } catch (e) {
        console.error('❌ Invalid DATABASE_URL format');
        console.error('Error:', e.message);
        return false;
    }
    
    const client = new Client({
        connectionString: DATABASE_URL,
        connectionTimeoutMillis: 10000 // 10 second timeout
    });
    
    try {
        console.log('Step 1: Creating client...');
        console.log('✅ Client created');
        
        console.log('\nStep 2: Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully!');
        
        console.log('\nStep 3: Running test query (SELECT 1)...');
        const testResult = await client.query('SELECT 1 AS ok, NOW() AS timestamp');
        console.log('✅ Query executed successfully!');
        console.log('   Result:', testResult.rows[0]);
        
        console.log('\nStep 4: Checking donors table...');
        try {
            const donorCheck = await client.query("SELECT COUNT(*) as count FROM donors");
            console.log('✅ Donors table exists!');
            console.log('   Total donors:', donorCheck.rows[0].count);
        } catch (e) {
            console.warn('⚠️  Donors table check failed:', e.message);
            console.log('   This may be OK if tables are not created yet.');
        }
        
        console.log('\nStep 5: Checking stats table...');
        try {
            const statsCheck = await client.query("SELECT * FROM stats WHERE identifier = 'global'");
            console.log('✅ Stats table exists!');
            console.log('   Stats row:', statsCheck.rows[0]);
        } catch (e) {
            console.warn('⚠️  Stats table check failed:', e.message);
            console.log('   This may be OK if tables are not created yet.');
        }
        
        console.log('\n=== Database Connection Test PASSED ===');
        console.log('Database is accessible and operational!');
        
        await client.end();
        return true;
        
    } catch (error) {
        console.error('\n❌ Database Connection Test FAILED');
        console.error('\nError Details:');
        console.error('  Type:', error.constructor.name);
        console.error('  Code:', error.code);
        console.error('  Message:', error.message);
        
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        
        console.error('\nCommon Issues:');
        if (error.code === 'ENOTFOUND') {
            console.error('- DNS cannot resolve hostname');
            console.error('- Check if hostname is correct');
            console.error('- Check network/firewall settings');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('- Database server is not accepting connections');
            console.error('- Port may be blocked by firewall');
        } else if (error.code === '28P01') {
            console.error('- Invalid password');
            console.error('- Check DATABASE_URL credentials');
        } else if (error.code === '3D000') {
            console.error('- Database does not exist');
            console.error('- Check database name in connection string');
        }
        
        try {
            await client.end();
        } catch (e) {
            // Ignore cleanup errors
        }
        
        return false;
    }
}

if (require.main === module) {
    testConnection().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = testConnection;
