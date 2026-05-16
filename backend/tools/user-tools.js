const { getConnection } = require('../sfdc-client');

async function listUsers({ isActive, limit = 20 } = {}) {
  const conn = await getConnection();
  let query = `SELECT Id, Name, Username, Email, IsActive, ProfileId, Profile.Name, UserRoleId, UserRole.Name, CreatedDate, LastLoginDate FROM User`;
  const conditions = ['IsPortalEnabled = false'];
  if (isActive !== undefined) conditions.push(`IsActive = ${isActive}`);
  query += ` WHERE ${conditions.join(' AND ')} ORDER BY Name LIMIT ${limit}`;

  const result = await conn.query(query);
  return result.records.map((u) => ({
    id: u.Id,
    name: u.Name,
    username: u.Username,
    email: u.Email,
    isActive: u.IsActive,
    profile: u.Profile?.Name || 'Unknown',
    role: u.UserRole?.Name || 'None',
    lastLogin: u.LastLoginDate,
  }));
}

async function getUserDetails({ userId, username, email }) {
  const conn = await getConnection();
  let whereClause;
  if (userId) whereClause = `Id = '${userId}'`;
  else if (username) whereClause = `Username = '${username}'`;
  else if (email) whereClause = `Email = '${email}'`;
  else throw new Error('Provide userId, username, or email');

  const query = `SELECT Id, Name, Username, Email, Phone, Title, Department, IsActive, ProfileId, Profile.Name, UserRoleId, UserRole.Name, ManagerId, Manager.Name, CreatedDate, LastLoginDate, LastModifiedDate FROM User WHERE ${whereClause} LIMIT 1`;
  const result = await conn.query(query);
  if (!result.records.length) throw new Error('User not found');
  const u = result.records[0];
  return {
    id: u.Id,
    name: u.Name,
    username: u.Username,
    email: u.Email,
    phone: u.Phone,
    title: u.Title,
    department: u.Department,
    isActive: u.IsActive,
    profile: u.Profile?.Name,
    profileId: u.ProfileId,
    role: u.UserRole?.Name || 'None',
    roleId: u.UserRoleId,
    manager: u.Manager?.Name || 'None',
    lastLogin: u.LastLoginDate,
    createdDate: u.CreatedDate,
  };
}

async function updateUser({ userId, username, email, updates }) {
  const conn = await getConnection();
  let id = userId;
  if (!id) {
    const user = await getUserDetails({ username, email });
    id = user.id;
  }
  await conn.sobject('User').update({ Id: id, ...updates });
  return { success: true, message: `User ${id} updated successfully`, updatedFields: Object.keys(updates) };
}

async function deactivateUser({ userId, username, email }) {
  return updateUser({ userId, username, email, updates: { IsActive: false } });
}

async function activateUser({ userId, username, email }) {
  return updateUser({ userId, username, email, updates: { IsActive: true } });
}

async function listProfiles() {
  const conn = await getConnection();
  const result = await conn.query(`SELECT Id, Name, UserType FROM Profile ORDER BY Name LIMIT 50`);
  return result.records.map((p) => ({ id: p.Id, name: p.Name, type: p.UserType }));
}

async function updateUserProfile({ userId, username, email, profileName, profileId }) {
  const conn = await getConnection();
  let pid = profileId;
  if (!pid && profileName) {
    const result = await conn.query(`SELECT Id FROM Profile WHERE Name = '${profileName}' LIMIT 1`);
    if (!result.records.length) throw new Error(`Profile '${profileName}' not found`);
    pid = result.records[0].Id;
  }
  return updateUser({ userId, username, email, updates: { ProfileId: pid } });
}

module.exports = { listUsers, getUserDetails, updateUser, deactivateUser, activateUser, listProfiles, updateUserProfile };
