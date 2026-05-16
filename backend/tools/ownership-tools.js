const { getConnection } = require('../sfdc-client');

const SUPPORTED_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'];

function validateObject(objectType) {
  const normalized = SUPPORTED_OBJECTS.find((o) => o.toLowerCase() === objectType.toLowerCase());
  if (!normalized) throw new Error(`Unsupported object. Supported: ${SUPPORTED_OBJECTS.join(', ')}`);
  return normalized;
}

async function getRecordOwner({ objectType, recordId, recordName }) {
  const conn = await getConnection();
  const obj = validateObject(objectType);

  let whereClause;
  if (recordId) whereClause = `Id = '${recordId}'`;
  else if (recordName) whereClause = `Name = '${recordName}'`;
  else throw new Error('Provide recordId or recordName');

  const nameField = obj === 'Case' ? 'CaseNumber' : 'Name';
  const query = `SELECT Id, ${nameField}, OwnerId, Owner.Name, Owner.Username FROM ${obj} WHERE ${whereClause} LIMIT 1`;
  const result = await conn.query(query);

  if (!result.records.length) throw new Error(`${obj} record not found`);
  const r = result.records[0];
  return {
    recordId: r.Id,
    recordName: r[nameField],
    objectType: obj,
    ownerId: r.OwnerId,
    ownerName: r.Owner?.Name,
    ownerUsername: r.Owner?.Username,
  };
}

async function transferRecordOwnership({ objectType, recordId, recordName, newOwnerUsername, newOwnerEmail, newOwnerId }) {
  const conn = await getConnection();
  const obj = validateObject(objectType);

  let newOwner = newOwnerId;
  if (!newOwner) {
    let whereClause = newOwnerUsername
      ? `Username = '${newOwnerUsername}'`
      : `Email = '${newOwnerEmail}'`;
    const userResult = await conn.query(`SELECT Id, Name FROM User WHERE ${whereClause} AND IsActive = true LIMIT 1`);
    if (!userResult.records.length) throw new Error('New owner user not found or inactive');
    newOwner = userResult.records[0].Id;
  }

  let recId = recordId;
  if (!recId && recordName) {
    const nameField = obj === 'Case' ? 'CaseNumber' : 'Name';
    const recResult = await conn.query(`SELECT Id FROM ${obj} WHERE ${nameField} = '${recordName}' LIMIT 1`);
    if (!recResult.records.length) throw new Error(`${obj} record not found`);
    recId = recResult.records[0].Id;
  }

  await conn.sobject(obj).update({ Id: recId, OwnerId: newOwner });
  return { success: true, message: `${obj} ownership transferred successfully`, recordId: recId, newOwnerId: newOwner };
}

async function bulkTransferOwnership({ objectType, currentOwnerUsername, currentOwnerEmail, newOwnerUsername, newOwnerEmail, limit = 50 }) {
  const conn = await getConnection();
  const obj = validateObject(objectType);

  // Resolve current owner
  let currentOwnerWhere = currentOwnerUsername
    ? `Username = '${currentOwnerUsername}'`
    : `Email = '${currentOwnerEmail}'`;
  const currentResult = await conn.query(`SELECT Id, Name FROM User WHERE ${currentOwnerWhere} LIMIT 1`);
  if (!currentResult.records.length) throw new Error('Current owner not found');
  const currentOwnerId = currentResult.records[0].Id;
  const currentOwnerName = currentResult.records[0].Name;

  // Resolve new owner
  let newOwnerWhere = newOwnerUsername
    ? `Username = '${newOwnerUsername}'`
    : `Email = '${newOwnerEmail}'`;
  const newResult = await conn.query(`SELECT Id, Name FROM User WHERE ${newOwnerWhere} AND IsActive = true LIMIT 1`);
  if (!newResult.records.length) throw new Error('New owner not found or inactive');
  const newOwnerId = newResult.records[0].Id;
  const newOwnerName = newResult.records[0].Name;

  // Get records owned by current owner
  const records = await conn.query(`SELECT Id FROM ${obj} WHERE OwnerId = '${currentOwnerId}' LIMIT ${limit}`);
  if (!records.records.length) return { success: true, message: `No ${obj} records found for ${currentOwnerName}`, transferred: 0 };

  const updates = records.records.map((r) => ({ Id: r.Id, OwnerId: newOwnerId }));
  const result = await conn.sobject(obj).update(updates);

  const succeeded = result.filter ? result.filter((r) => r.success).length : updates.length;
  return {
    success: true,
    message: `Transferred ${succeeded} ${obj} records from ${currentOwnerName} to ${newOwnerName}`,
    transferred: succeeded,
    total: records.records.length,
  };
}

async function listRecords({ objectType, ownerId, ownerUsername, limit = 10 }) {
  const conn = await getConnection();
  const obj = validateObject(objectType);
  const nameField = obj === 'Case' ? 'CaseNumber' : 'Name';

  let whereClause = '';
  if (ownerId) whereClause = `WHERE OwnerId = '${ownerId}'`;
  else if (ownerUsername) {
    const u = await conn.query(`SELECT Id FROM User WHERE Username = '${ownerUsername}' LIMIT 1`);
    if (u.records.length) whereClause = `WHERE OwnerId = '${u.records[0].Id}'`;
  }

  const query = `SELECT Id, ${nameField}, OwnerId, Owner.Name FROM ${obj} ${whereClause} ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
  const result = await conn.query(query);
  return result.records.map((r) => ({
    id: r.Id,
    name: r[nameField],
    ownerId: r.OwnerId,
    ownerName: r.Owner?.Name,
  }));
}

module.exports = { getRecordOwner, transferRecordOwnership, bulkTransferOwnership, listRecords };
