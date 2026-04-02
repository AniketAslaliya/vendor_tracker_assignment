const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { initializeDatabase, dbPath } = require('./db');

const PORT = Number(process.env.PORT) || 4000;

function mapVendor(row, selectedVendorId) {
  const totalCost = Number(row.quoted_price) + Number(row.shipping_cost);

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contact: {
      name: row.contact_name,
      phone: row.contact_phone,
      email: row.contact_email,
    },
    quote: {
      quotedPrice: Number(row.quoted_price),
      shippingCost: Number(row.shipping_cost),
      totalCost,
      leadTimeDays: row.lead_time_days,
    },
    notes: row.notes,
    isSelected: row.id === selectedVendorId,
  };
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = new Array(right.length + 1);
  const current = new Array(right.length + 1);

  for (let column = 0; column <= right.length; column += 1) {
    previous[column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost,
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length];
}

function getSearchSuggestions(rows, searchQuery, limit = 6) {
  const normalizedQuery = normalizeText(searchQuery);
  if (!normalizedQuery) {
    return [];
  }

  const threshold = normalizedQuery.length <= 4 ? 0.62 : 0.48;

  const scored = rows
    .map((row) => {
      const normalizedName = normalizeText(row.name);
      const normalizedContact = normalizeText(row.contact_name);
      const normalizedEmail = normalizeText(row.contact_email);

      if (!normalizedName) {
        return null;
      }

      if (
        normalizedName.includes(normalizedQuery) ||
        normalizedContact.includes(normalizedQuery) ||
        normalizedEmail.includes(normalizedQuery)
      ) {
        return {
          name: row.name,
          score: 0,
        };
      }

      const distance = levenshteinDistance(normalizedQuery, normalizedName);
      const normalizedDistance = distance / Math.max(normalizedQuery.length, normalizedName.length);

      if (normalizedDistance > threshold) {
        return null;
      }

      return {
        name: row.name,
        score: normalizedDistance,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return left.name.localeCompare(right.name);
    });

  const suggestions = [];
  const seen = new Set();

  for (const item of scored) {
    if (seen.has(item.name)) {
      continue;
    }

    seen.add(item.name);
    suggestions.push(item.name);

    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions;
}

async function getDecisionMemo(db) {
  const memo = await db.get(
    "SELECT value FROM app_state WHERE key = 'decisionMemo'",
  );

  if (!memo) {
    return {
      vendorId: null,
      content: '',
      updatedAt: null,
    };
  }

  try {
    return JSON.parse(memo.value);
  } catch {
    return {
      vendorId: null,
      content: '',
      updatedAt: null,
    };
  }
}

async function getSelectedVendorId(db) {
  const selection = await db.get(
    "SELECT value FROM app_state WHERE key = 'selectedVendorId'",
  );

  return selection ? Number(selection.value) : null;
}

async function getSelectedVendor(db) {
  const selectedVendorId = await getSelectedVendorId(db);

  if (!selectedVendorId) {
    return null;
  }

  const row = await db.get(
    `
      SELECT
        id,
        name,
        category,
        contact_name,
        contact_phone,
        contact_email,
        quoted_price,
        shipping_cost,
        lead_time_days,
        notes
      FROM vendors
      WHERE id = ?
    `,
    selectedVendorId,
  );

  return row ? mapVendor(row, selectedVendorId) : null;
}

function buildCsv(rows) {
  const header = [
    'Name',
    'Category',
    'Contact Name',
    'Contact Phone',
    'Contact Email',
    'Quoted Price',
    'Shipping Cost',
    'Total Cost',
    'Lead Time Days',
  ];

  const lines = rows.map((row) =>
    [
      row.name,
      row.category,
      row.contact_name,
      row.contact_phone,
      row.contact_email,
      row.quoted_price,
      row.shipping_cost,
      Number(row.quoted_price) + Number(row.shipping_cost),
      row.lead_time_days,
    ]
      .map((field) => `"${String(field).replaceAll('"', '""')}"`)
      .join(','),
  );

  return [header.join(','), ...lines].join('\n');
}

async function startServer() {
  const db = await initializeDatabase();
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: path.relative(process.cwd(), dbPath),
    });
  });

  app.get('/api/vendors', async (req, res) => {
    const search = req.query.search?.trim() ?? '';
    const category = req.query.category?.trim() ?? '';

    const filters = [];
    const values = [];

    if (search) {
      filters.push('(name LIKE ? OR contact_name LIKE ? OR contact_email LIKE ?)');
      const pattern = `%${search}%`;
      values.push(pattern, pattern, pattern);
    }

    if (category) {
      filters.push('category = ?');
      values.push(category);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = await db.all(
      `
        SELECT
          id,
          name,
          category,
          contact_name,
          contact_phone,
          contact_email,
          quoted_price,
          shipping_cost,
          lead_time_days,
          notes
        FROM vendors
        ${whereClause}
        ORDER BY name ASC
      `,
      values,
    );

    const suggestionRows = await db.all(
      `
        SELECT
          name,
          contact_name,
          contact_email
        FROM vendors
        ${category ? 'WHERE category = ?' : ''}
      `,
      category ? [category] : [],
    );

    const categories = await db.all(
      'SELECT DISTINCT category FROM vendors ORDER BY category ASC',
    );
    const selectedVendorId = await getSelectedVendorId(db);
    const decisionMemo = await getDecisionMemo(db);
    const selectedVendor = await getSelectedVendor(db);

    const vendors = rows.map((row) => mapVendor(row, selectedVendorId));
    const stats = vendors.reduce(
      (accumulator, vendor) => {
        accumulator.totalQuotedPrice += vendor.quote.quotedPrice;
        accumulator.totalLeadTime += vendor.quote.leadTimeDays;
        return accumulator;
      },
      { totalQuotedPrice: 0, totalLeadTime: 0 },
    );

    res.json({
      vendors,
      searchSuggestions: getSearchSuggestions(suggestionRows, search),
      categories: categories.map((item) => item.category),
      selectedVendorId,
      selectedVendor,
      decisionMemo,
      summary: {
        vendorCount: vendors.length,
        averageQuotedPrice:
          vendors.length > 0 ? stats.totalQuotedPrice / vendors.length : 0,
        averageLeadTimeDays:
          vendors.length > 0 ? stats.totalLeadTime / vendors.length : 0,
      },
    });
  });

  app.get('/api/selection', async (_req, res) => {
    const decisionMemo = await getDecisionMemo(db);

    res.json({
      selectedVendorId: await getSelectedVendorId(db),
      selectedVendor: await getSelectedVendor(db),
      decisionMemo,
    });
  });

  app.post('/api/selection', async (req, res) => {
    const vendorId = Number(req.body.vendorId);

    if (!Number.isInteger(vendorId)) {
      return res.status(400).json({ message: 'vendorId must be an integer.' });
    }

    const vendor = await db.get('SELECT id FROM vendors WHERE id = ?', vendorId);

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    await db.run(
      `
        INSERT INTO app_state (key, value)
        VALUES ('selectedVendorId', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      String(vendorId),
    );

    return res.json({
      message: 'Selection saved.',
      selectedVendorId: vendorId,
    });
  });

  app.post('/api/decision-memo', async (req, res) => {
    const vendorId = Number(req.body.vendorId);
    const content = String(req.body.content ?? '').trim();

    if (!Number.isInteger(vendorId)) {
      return res.status(400).json({ message: 'vendorId must be an integer.' });
    }

    if (content.length > 400) {
      return res
        .status(400)
        .json({ message: 'Decision memo must be 400 characters or fewer.' });
    }

    const vendor = await db.get('SELECT id FROM vendors WHERE id = ?', vendorId);

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    const payload = JSON.stringify({
      vendorId,
      content,
      updatedAt: new Date().toISOString(),
    });

    await db.run(
      `
        INSERT INTO app_state (key, value)
        VALUES ('decisionMemo', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      payload,
    );

    return res.json({
      message: 'Decision memo saved.',
      decisionMemo: JSON.parse(payload),
    });
  });

  app.get('/api/vendors/export.csv', async (req, res) => {
    const scope = req.query.scope?.trim() || 'all';
    const ids = req.query.ids?.trim() || '';
    const selectedVendorId = await getSelectedVendorId(db);
    let rows;

    if (scope === 'selected') {
      if (!selectedVendorId) {
        return res.status(400).json({ message: 'No vendor is currently selected.' });
      }

      rows = await db.all(
        `
          SELECT
            name,
            category,
            contact_name,
            contact_phone,
            contact_email,
            quoted_price,
            shipping_cost,
            lead_time_days
          FROM vendors
          WHERE id = ?
        `,
        selectedVendorId,
      );
    } else if (scope === 'ids') {
      const parsedIds = ids
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value));

      if (parsedIds.length === 0) {
        return res.status(400).json({ message: 'No vendor ids were provided.' });
      }

      const placeholders = parsedIds.map(() => '?').join(', ');
      const fetchedRows = await db.all(
        `
          SELECT
            id,
            name,
            category,
            contact_name,
            contact_phone,
            contact_email,
            quoted_price,
            shipping_cost,
            lead_time_days
          FROM vendors
          WHERE id IN (${placeholders})
        `,
        parsedIds,
      );

      const orderMap = new Map(parsedIds.map((id, index) => [id, index]));
      rows = fetchedRows.sort((left, right) => orderMap.get(left.id) - orderMap.get(right.id));
    } else {
      rows = await db.all(`
        SELECT
          name,
          category,
          contact_name,
          contact_phone,
          contact_email,
          quoted_price,
          shipping_cost,
          lead_time_days
        FROM vendors
        ORDER BY name ASC
      `);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="vendor-comparison.csv"',
    );
    res.send(buildCsv(rows));
  });

  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

  app.get(/^\/(?!api).*/, (_req, res) => {
    return res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Vendor Tracker API running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
