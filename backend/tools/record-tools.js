'use strict';
const { getConnection } = require('../sfdc-client');

const SUPPORTED_OBJECTS = [
  // CRM core
  'Account', 'Contact', 'Opportunity', 'Lead', 'Case',
  // Activity
  'Task', 'Event',
  // Commerce / CPQ
  'Contract', 'Order', 'Quote', 'QuoteLineItem',
  'Pricebook2', 'PricebookEntry', 'Product2', 'OrderItem',
  // Marketing
  'Campaign', 'CampaignMember',
  // Service
  'Asset', 'Entitlement', 'ServiceContract',
  // Admin / Setup
  'User', 'UserRole', 'Profile', 'PermissionSet',
  'Group', 'GroupMember', 'Queue',
  // Reporting / Audit
  'Report', 'Dashboard', 'LoginHistory', 'AuthSession',
  // Misc
  'Attachment', 'ContentDocument', 'ContentVersion', 'Note',
];

function validateObject(objectType) {
  const normalized = SUPPORTED_OBJECTS.find((o) => o.toLowerCase() === objectType.toLowerCase());
  if (!normalized) throw new Error(`Unsupported object '${objectType}'. Supported: ${SUPPORTED_OBJECTS.join(', ')}`);
  return normalized;
}

async function resolveRecordId(conn, obj, recordId, recordName) {
  if (recordId) return recordId;
  if (!recordName) throw new Error('Provide recordId or recordName');
  const nameField = obj === 'Case' ? 'CaseNumber' : 'Name';
  const result = await conn.query(`SELECT Id FROM ${obj} WHERE ${nameField} = '${recordName.replace(/'/g, "\\'")}' LIMIT 1`);
  if (!result.records.length) throw new Error(`${obj} record '${recordName}' not found`);
  return result.records[0].Id;
}

async function updateRecord({ objectType, recordId, recordName, fields }) {
  if (!fields || !Object.keys(fields).length) throw new Error('fields is required and must not be empty');
  const conn = await getConnection();
  const obj = validateObject(objectType);
  const id = await resolveRecordId(conn, obj, recordId, recordName);
  await conn.sobject(obj).update({ Id: id, ...fields });
  return {
    success: true,
    message: `${obj} record updated successfully`,
    recordId: id,
    updatedFields: Object.keys(fields),
  };
}

async function createRecord({ objectType, fields }) {
  if (!fields || !Object.keys(fields).length) throw new Error('fields is required');
  const conn = await getConnection();
  const obj = validateObject(objectType);
  const result = await conn.sobject(obj).create(fields);
  if (!result.success) throw new Error(`Create failed: ${JSON.stringify(result.errors)}`);
  return { success: true, message: `${obj} record created`, recordId: result.id };
}

async function deleteRecord({ objectType, recordId, recordName }) {
  const conn = await getConnection();
  const obj = validateObject(objectType);
  const id = await resolveRecordId(conn, obj, recordId, recordName);
  await conn.sobject(obj).delete(id);
  return { success: true, message: `${obj} record deleted`, recordId: id };
}

async function getRecord({ objectType, recordId, recordName, fields }) {
  const conn = await getConnection();
  const obj = validateObject(objectType);
  const fieldList = fields && fields.length ? fields.join(', ') : 'Id, Name';
  let whereClause;
  if (recordId) whereClause = `Id = '${recordId}'`;
  else if (recordName) {
    const nameField = obj === 'Case' ? 'CaseNumber' : 'Name';
    whereClause = `${nameField} = '${recordName.replace(/'/g, "\\'")}'`;
  } else throw new Error('Provide recordId or recordName');
  const result = await conn.query(`SELECT ${fieldList} FROM ${obj} WHERE ${whereClause} LIMIT 1`);
  if (!result.records.length) throw new Error(`${obj} record not found`);
  return result.records[0];
}

// Generic SOQL query — no object restriction, full SELECT support
async function queryRecords({ soql, limit }) {
  const conn = await getConnection();
  const query = limit ? soql.replace(/LIMIT\s+\d+/i, `LIMIT ${limit}`) : soql;
  const result = await conn.query(query.includes('LIMIT') ? query : `${query} LIMIT ${limit || 50}`);
  return { totalSize: result.totalSize, records: result.records };
}

// Describe an object's fields (schema inspection)
async function describeObject({ objectType }) {
  const conn = await getConnection();
  const meta = await conn.describe(objectType);
  return {
    label: meta.label,
    fields: meta.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      updateable: f.updateable,
      nillable: f.nillable,
    })),
  };
}

module.exports = { updateRecord, createRecord, deleteRecord, getRecord, queryRecords, describeObject, SUPPORTED_OBJECTS };
