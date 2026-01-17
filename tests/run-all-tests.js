/**
 * Master Test Runner
 * Runs all diagnostic tests in sequence
 */

const testDNS = require('./test-dns');
const testConnection = require('./test-db-connection');
const testEnv = require('./test-env');

async function runAllTests() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║     Blood Donation System - Diagnostic Test Suite        ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    const results = {
        env: false,
        dns: false,
        connection: false
    };
    
    // Test 1: Environment Variables
    try {
        console.log('TEST 1/3: Environment Variables\n');
        results.env = testEnv();
        console.log('\n');
    } catch (error) {
        console.error('❌ Environment test crashed:', error.message);
        console.log('\n');
    }
    
    // Test 2: DNS Resolution
    try {
        console.log('TEST 2/3: DNS Resolution\n');
        results.dns = await testDNS();
        console.log('\n');
    } catch (error) {
        console.error('❌ DNS test crashed:', error.message);
        console.log('\n');
    }
    
    // Test 3: Database Connection
    try {
        console.log('TEST 3/3: Database Connection\n');
        results.connection = await testConnection();
        console.log('\n');
    } catch (error) {
        console.error('❌ Connection test crashed:', error.message);
        console.log('\n');
    }
    
    // Summary
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`Environment Variables: ${results.env ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`DNS Resolution:        ${results.dns ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Database Connection:   ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
    console.log();
    
    const allPassed = results.env && results.dns && results.connection;
    
    if (allPassed) {
        console.log('✅ ALL TESTS PASSED!');
        console.log('Your local environment is properly configured.');
        console.log();
        console.log('If your Vercel deployment is failing, the issue is likely:');
        console.log('1. DATABASE_URL not set in Vercel environment variables');
        console.log('2. Vercel network restrictions blocking Supabase access');
        console.log('3. Different environment between local and Vercel');
        console.log();
        console.log('Next steps:');
        console.log('- Go to Vercel Dashboard → Project → Settings → Environment Variables');
        console.log('- Add DATABASE_URL with your connection string');
        console.log('- Make sure to enable it for Production, Preview, and Development');
        console.log('- Redeploy your application');
    } else {
        console.log('❌ SOME TESTS FAILED');
        console.log();
        
        if (!results.env) {
            console.log('Environment Variables Issue:');
            console.log('- DATABASE_URL is not set or improperly formatted');
            console.log('- Set it in your terminal: export DATABASE_URL="your-connection-string"');
            console.log('- Or create a .env file (don\'t commit it!)');
            console.log();
        }
        
        if (!results.dns) {
            console.log('DNS Resolution Issue:');
            console.log('- Cannot resolve db.lwgnhieekdjtnvpxqull.supabase.co');
            console.log('- Check your internet connection');
            console.log('- Check if Supabase is accessible from your location');
            console.log('- Try: ping db.lwgnhieekdjtnvpxqull.supabase.co');
            console.log();
        }
        
        if (!results.connection) {
            console.log('Database Connection Issue:');
            console.log('- Cannot connect to the database');
            console.log('- Check your credentials in DATABASE_URL');
            console.log('- Verify your Supabase project is active');
            console.log('- Check if firewall is blocking port 5432');
            console.log();
        }
    }
    
    return allPassed;
}

if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Fatal error running tests:', error);
        process.exit(1);
    });
}

module.exports = runAllTests;
