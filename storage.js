const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const STORAGE_DIR = path.join(__dirname, "storage");
const MODEL_FILES = {
  admins: "admins.json",
  students: "students.json",
  payments: "payments.json",
  leaveRequests: "leaveRequests.json",
  attendance: "attendance.json",
  messages: "messages.json",
  settings: "settings.json",
};

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }
  return value;
}

function matchValue(actual, expected) {
  const actualNormalized = normalizeValue(actual);
  const expectedNormalized = normalizeValue(expected);

  if (actualNormalized === expectedNormalized) {
    return true;
  }

  if (actualNormalized == expectedNormalized) {
    return true;
  }

  if (Array.isArray(actualNormalized) && Array.isArray(expectedNormalized)) {
    return (
      actualNormalized.length === expectedNormalized.length &&
      actualNormalized.every((item, index) => matchValue(item, expectedNormalized[index]))
    );
  }

  return false;
}

function matches(item, query) {
  if (!query || Object.keys(query).length === 0) {
    return true;
  }

  return Object.entries(query).every(([key, value]) => {
    const actualValue = item[key];
    if (typeof value === "function") {
      return value(actualValue);
    }
    return matchValue(actualValue, value);
  });
}

function normalizeDoc(doc) {
  if (doc === null || doc === undefined) return doc;
  if (Array.isArray(doc)) return doc.map(normalizeDoc);
  if (typeof doc !== "object") return doc;

  const normalized = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value instanceof Date) {
      normalized[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      normalized[key] = value.map(normalizeDoc);
    } else if (value && typeof value === "object") {
      normalized[key] = normalizeDoc(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

async function ensureStorageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function getModelFile(model) {
  // normalize model name to lowercase plural (e.g., 'Admin' -> 'admins')
  let key = String(model || "").trim();
  if (!key) throw new Error(`Unknown storage model: ${model}`);
  key = key.replace(/Model$/i, "");
  key = key.toLowerCase();
  if (!key.endsWith("s")) key = `${key}s`;

  const fileName = MODEL_FILES[key];
  if (!fileName) {
    throw new Error(`Unknown storage model: ${model} (normalized to ${key})`);
  }
  return path.join(STORAGE_DIR, fileName);
}

async function readModel(model) {
  await ensureStorageDir();
  const filePath = await getModelFile(model);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return JSON.parse(text || "[]");
  } catch (err) {
    if (err.code === "ENOENT") {
      const data = [];
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return data;
    }
    throw err;
  }
}

async function writeModel(model, data) {
  await ensureStorageDir();
  const filePath = await getModelFile(model);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function sortItems(items, sort) {
  if (!sort || Object.keys(sort).length === 0) {
    return items;
  }

  const [[key, direction]] = Object.entries(sort);
  const multiplier = direction === -1 ? -1 : 1;

  return [...items].sort((a, b) => {
    const left = a[key] === undefined ? "" : a[key];
    const right = b[key] === undefined ? "" : b[key];

    if (left === right) return 0;
    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right) * multiplier;
    }
    return (left > right ? 1 : -1) * multiplier;
  });
}

async function find(model, query = {}, sort) {
  const items = await readModel(model);
  const results = items.filter((item) => matches(item, query));
  return sortItems(results, sort);
}

async function findOne(model, query = {}, sort) {
  const results = await find(model, query, sort);
  return results.length ? results[0] : null;
}

async function create(model, doc) {
  const items = await readModel(model);
  const normalized = normalizeDoc(doc);
  const now = new Date().toISOString();
  const record = {
    _id: normalized._id || crypto.randomUUID(),
    createdAt: normalized.createdAt || now,
    updatedAt: normalized.updatedAt || now,
    ...normalized,
  };

  items.push(record);
  await writeModel(model, items);
  return record;
}

async function findOneAndUpdate(model, query, update, options = {}) {
  const items = await readModel(model);
  const index = items.findIndex((item) => matches(item, query));

  if (index === -1) {
    if (options.upsert) {
      const created = await create(model, { ...query, ...update });
      return options.new ? created : created;
    }
    return null;
  }

  const existing = items[index];
  const updated = {
    ...existing,
    ...normalizeDoc(update),
    updatedAt: new Date().toISOString(),
  };
  items[index] = updated;
  await writeModel(model, items);
  return options.new ? updated : updated;
}

async function findById(model, id) {
  return findOne(model, { _id: id });
}

async function findByIdAndUpdate(model, id, update, options = {}) {
  const items = await readModel(model);
  const index = items.findIndex((item) => item._id === id);
  if (index === -1) {
    return null;
  }

  const existing = items[index];
  const updated = {
    ...existing,
    ...normalizeDoc(update),
    updatedAt: new Date().toISOString(),
  };
  items[index] = updated;
  await writeModel(model, items);
  return options.new ? updated : updated;
}

async function deleteOne(model, query) {
  const items = await readModel(model);
  const index = items.findIndex((item) => matches(item, query));
  if (index === -1) {
    return { deletedCount: 0 };
  }
  items.splice(index, 1);
  await writeModel(model, items);
  return { deletedCount: 1 };
}

async function deleteMany(model, query) {
  const items = await readModel(model);
  const remaining = items.filter((item) => !matches(item, query));
  const deletedCount = items.length - remaining.length;
  await writeModel(model, remaining);
  return { deletedCount };
}

async function findOneAndDelete(model, query) {
  const items = await readModel(model);
  const index = items.findIndex((item) => matches(item, query));
  if (index === -1) {
    return null;
  }
  const [deleted] = items.splice(index, 1);
  await writeModel(model, items);
  return deleted;
}

async function save(model, doc) {
  if (!doc || typeof doc !== "object") {
    throw new Error("Cannot save invalid document");
  }

  if (!doc._id) {
    return create(model, doc);
  }

  const items = await readModel(model);
  const index = items.findIndex((item) => item._id === doc._id);
  const normalized = normalizeDoc(doc);

  if (index === -1) {
    return create(model, normalized);
  }

  const existing = items[index];
  const updated = {
    ...existing,
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
  items[index] = updated;
  await writeModel(model, items);
  return updated;
}

module.exports = {
  find,
  findOne,
  create,
  findOneAndUpdate,
  findById,
  findByIdAndUpdate,
  deleteOne,
  deleteMany,
  findOneAndDelete,
  save,
};
