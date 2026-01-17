/**
 * DNS Resolution Test
 * Tests if the Supabase database hostname can be resolved
 */

const dns = require('dns').promises;

const DB_HOST = 'db.lwgnhieekdjtnvpxqull.supabase.co';

async function testDNS() {
    console.log('=== DNS Resolution Test ===\n');
    console.log(`Testing hostname: ${DB_HOST}`);
    
    try {
        console.log('\n1. Testing DNS lookup...');
        const addresses = await dns.lookup(DB_HOST);
        console.log('✅ DNS lookup successful!');
        console.log('   Address:', addresses.address);
        console.log('   Family:', addresses.family === 4 ? 'IPv4' : 'IPv6');
        
        console.log('\n2. Testing DNS resolve (all IPs)...');
        const allAddresses = await dns.resolve(DB_HOST);
        console.log('✅ DNS resolve successful!');
        console.log('   IPs:', allAddresses.join(', '));
        
        console.log('\n3. Testing reverse lookup...');
        const hostnames = await dns.reverse(addresses.address);
        console.log('✅ Reverse lookup successful!');
        console.log('   Hostnames:', hostnames.join(', '));
        
        console.log('\n=== DNS Test PASSED ===');
        console.log('The hostname can be resolved. Network connectivity should work.');
        return true;
        
    } catch (error) {
        console.error('\n❌ DNS Test FAILED');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('\nPossible causes:');
        console.error('- Network/firewall blocking DNS');
        console.error('- Incorrect hostname');
        console.error('- DNS server issues');
        console.error('- No internet connection');
        
        if (error.code === 'ENOTFOUND') {
            console.error('\n⚠️  ENOTFOUND means the hostname does not exist or cannot be resolved.');
            console.error('Check if the Supabase project URL is correct.');
        }
        
        return false;
    }
}

if (require.main === module) {
    testDNS().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = testDNS;
