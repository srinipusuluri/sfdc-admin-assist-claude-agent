require('dotenv').config();
const { testConnection } = require('./sfdc-client');

(async () => {
  console.log('Testing Salesforce connection...');
  const result = await testConnection();
  if (result.connected) {
    console.log('✅ Connected!');
    console.log(`   User:      ${result.displayName} (${result.username})`);
    console.log(`   Org ID:    ${result.orgId}`);
    console.log(`   Instance:  ${result.instanceUrl}`);
  } else {
    console.error('❌ Connection failed:', result.error);
    console.log('\nCheck your .env file:');
    console.log('  SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN, SF_LOGIN_URL');
    process.exit(1);
  }
})();
