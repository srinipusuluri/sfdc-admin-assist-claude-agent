'use strict';
require('dotenv').config();
const jsforce = require('jsforce');
const { execSync } = require('child_process');

async function refreshSFAuth() {
  const conn = new jsforce.Connection({ loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com' });
  await conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD + (process.env.SF_SECURITY_TOKEN || ''));
  execSync(
    `sf org login access-token --instance-url ${conn.instanceUrl} --alias sfdc-admin-assist --no-prompt`,
    { env: { ...process.env, SF_ACCESS_TOKEN: conn.accessToken }, input: conn.accessToken + '\n', stdio: ['pipe','pipe','pipe'] }
  );
  return { instanceUrl: conn.instanceUrl, username: process.env.SF_USERNAME };
}

module.exports = { refreshSFAuth };
