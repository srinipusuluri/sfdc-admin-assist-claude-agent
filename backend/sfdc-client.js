const jsforce = require('jsforce');

let connection = null;

// Determine auth mode from env vars
function isConnectedApp() {
  return !!(process.env.SF_CONSUMER_KEY && process.env.SF_CONSUMER_SECRET);
}

async function getConnection() {
  if (connection && connection.accessToken) {
    return connection;
  }

  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
  const username = process.env.SF_USERNAME;
  const password = process.env.SF_PASSWORD;

  if (!username || !password) {
    throw new Error('SF_USERNAME and SF_PASSWORD must be set in .env');
  }

  const passwordWithToken = password + (process.env.SF_SECURITY_TOKEN || '');

  if (isConnectedApp()) {
    // Try OAuth 2.0 Resource Owner Password Credentials Grant via Connected App first.
    // Requires "Allow OAuth Username-Password Flows" enabled in Setup → App Manager → [App] → Edit Policies.
    // Falls back to SOAP session auth if the OAuth flow is not yet enabled.
    try {
      connection = new jsforce.Connection({
        oauth2: {
          loginUrl: 'https://login.salesforce.com',
          clientId: process.env.SF_CONSUMER_KEY,
          clientSecret: process.env.SF_CONSUMER_SECRET,
        },
      });
      await connection.login(username, passwordWithToken);
      connection._authMethod = 'OAuth 2.0 Connected App';
    } catch (oauthErr) {
      if (oauthErr.message.includes('authentication failure') || oauthErr.message.includes('invalid_grant')) {
        // OAuth password flow not enabled — fall back to SOAP session auth
        connection = new jsforce.Connection({ loginUrl });
        await connection.login(username, passwordWithToken);
        connection._authMethod = 'SOAP (enable OAuth in Connected App)';
      } else {
        throw oauthErr;
      }
    }
  } else {
    connection = new jsforce.Connection({ loginUrl });
    await connection.login(username, passwordWithToken);
    connection._authMethod = 'Username / Password';
  }

  return connection;
}

async function testConnection() {
  try {
    const conn = await getConnection();
    const identity = await conn.identity();
    return {
      connected: true,
      username: identity.username,
      orgId: identity.organization_id,
      displayName: identity.display_name,
      instanceUrl: conn.instanceUrl,
      authMethod: conn._authMethod || (isConnectedApp() ? 'OAuth 2.0 Connected App' : 'Username / Password'),
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = { getConnection, testConnection, isConnectedApp };
