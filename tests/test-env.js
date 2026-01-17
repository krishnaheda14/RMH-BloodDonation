/**
 * Environment Variables Validation Test
 * Checks if required environment variables are properly set
 */

function testEnvironmentVariables() {
    console.log('=== Environment Variables Test ===\n');
    
    const requiredVars = ['DATABASE_URL'];
    const optionalVars = ['DEBUG', 'NODE_ENV', 'PORT'];
    let allGood = true;
    
    console.log('Required Variables:');
    requiredVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: SET`);
            
            // Parse and validate DATABASE_URL
            if (varName === 'DATABASE_URL') {
                try {
                    const url = new URL(value.replace('postgresql://', 'http://'));
                    console.log(`   Format: VALID`);
                    console.log(`   Host: ${url.hostname}`);
                    console.log(`   Port: ${url.port || 5432}`);
                    console.log(`   Database: ${url.pathname.slice(1) || 'postgres'}`);
                    console.log(`   User: ${url.username}`);
                    console.log(`   Password: ${url.password ? '***' + url.password.slice(-4) : 'NOT SET'}`);
                    
                    // Check for common issues
                    if (value.includes('\n') || value.includes('\r')) {
                        console.warn('⚠️  WARNING: Contains newline characters!');
                        allGood = false;
                    }
                    if (value.startsWith('"') || value.startsWith("'")) {
                        console.warn('⚠️  WARNING: Starts with quote character!');
                        allGood = false;
                    }
                    if (value.endsWith('"') || value.endsWith("'")) {
                        console.warn('⚠️  WARNING: Ends with quote character!');
                        allGood = false;
                    }
                    if (value.includes(' ')) {
                        console.warn('⚠️  WARNING: Contains spaces (unusual)');
                    }
                } catch (e) {
                    console.error(`❌ Format: INVALID - ${e.message}`);
                    allGood = false;
                }
            }
        } else {
            console.error(`❌ ${varName}: NOT SET`);
            allGood = false;
        }
    });
    
    console.log('\nOptional Variables:');
    optionalVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: ${value}`);
        } else {
            console.log(`ℹ️  ${varName}: not set (optional)`);
        }
    });
    
    console.log('\nAll Environment Variables:');
    const allEnvVars = Object.keys(process.env).filter(key => 
        !key.startsWith('npm_') && 
        !key.startsWith('VSCODE_') &&
        !key.startsWith('TERM') &&
        !key.includes('PATH')
    );
    console.log(`Found ${allEnvVars.length} relevant environment variables:`);
    allEnvVars.forEach(key => {
        const value = process.env[key];
        if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')) {
            console.log(`  ${key}: ***${value?.slice(-4) || ''}`);
        } else if (value && value.length > 50) {
            console.log(`  ${key}: ${value.substring(0, 50)}...`);
        } else {
            console.log(`  ${key}: ${value}`);
        }
    });
    
    console.log('\n' + '='.repeat(50));
    if (allGood) {
        console.log('✅ Environment Variables Test PASSED');
        console.log('All required variables are properly set!');
    } else {
        console.error('❌ Environment Variables Test FAILED');
        console.error('Some variables are missing or improperly formatted.');
    }
    
    return allGood;
}

if (require.main === module) {
    const success = testEnvironmentVariables();
    process.exit(success ? 0 : 1);
}

module.exports = testEnvironmentVariables;
