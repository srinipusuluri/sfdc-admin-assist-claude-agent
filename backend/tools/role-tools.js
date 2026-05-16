const { getConnection } = require('../sfdc-client');

async function listRoles() {
  const conn = await getConnection();
  const result = await conn.query(
    `SELECT Id, Name, DeveloperName, ParentRoleId, ParentRole.Name FROM UserRole ORDER BY Name LIMIT 100`
  );
  return result.records.map((r) => ({
    id: r.Id,
    name: r.Name,
    developerName: r.DeveloperName,
    parentRole: r.ParentRole?.Name || 'Top Level',
  }));
}

async function getUserRole({ userId, username, email }) {
  const conn = await getConnection();
  let whereClause;
  if (userId) whereClause = `Id = '${userId}'`;
  else if (username) whereClause = `Username = '${username}'`;
  else if (email) whereClause = `Email = '${email}'`;
  else throw new Error('Provide userId, username, or email');

  const result = await conn.query(
    `SELECT Id, Name, Username, UserRoleId, UserRole.Name FROM User WHERE ${whereClause} LIMIT 1`
  );
  if (!result.records.length) throw new Error('User not found');
  const u = result.records[0];
  return {
    userId: u.Id,
    userName: u.Name,
    username: u.Username,
    roleId: u.UserRoleId,
    roleName: u.UserRole?.Name || 'No Role Assigned',
  };
}

async function updateUserRole({ userId, username, email, roleName, roleId }) {
  const conn = await getConnection();
  let rid = roleId;
  if (!rid && roleName) {
    const result = await conn.query(`SELECT Id FROM UserRole WHERE Name = '${roleName}' LIMIT 1`);
    if (!result.records.length) throw new Error(`Role '${roleName}' not found`);
    rid = result.records[0].Id;
  }

  let uid = userId;
  if (!uid) {
    let whereClause = username ? `Username = '${username}'` : `Email = '${email}'`;
    const result = await conn.query(`SELECT Id, Name FROM User WHERE ${whereClause} LIMIT 1`);
    if (!result.records.length) throw new Error('User not found');
    uid = result.records[0].Id;
  }

  await conn.sobject('User').update({ Id: uid, UserRoleId: rid || null });
  return {
    success: true,
    message: rid ? `Role updated successfully` : `Role removed from user`,
    userId: uid,
    newRoleId: rid,
    newRoleName: roleName || (rid ? 'Updated' : 'None'),
  };
}

async function removeUserRole({ userId, username, email }) {
  const conn = await getConnection();
  let uid = userId;
  if (!uid) {
    let whereClause = username ? `Username = '${username}'` : `Email = '${email}'`;
    const result = await conn.query(`SELECT Id FROM User WHERE ${whereClause} LIMIT 1`);
    if (!result.records.length) throw new Error('User not found');
    uid = result.records[0].Id;
  }
  await conn.sobject('User').update({ Id: uid, UserRoleId: null });
  return { success: true, message: 'Role removed from user', userId: uid };
}

module.exports = { listRoles, getUserRole, updateUserRole, removeUserRole };
