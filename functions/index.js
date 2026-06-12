const {onRequest} = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();

const ADMIN_ACCESS_URL =
  'https://asia-southeast1-pattra8-54c3f.cloudfunctions.net/adminAccessMatrix';
const ALLOWED_ORIGINS = new Set([
  'https://pattra8.com',
  'https://www.pattra8.com',
  'https://pattra8.github.io',
]);

/**
 * Normalizes Pattra house numbers.
 * @param {unknown} value
 * @return {string}
 */
function normalizeHouseNo(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

/**
 * Applies CORS for the production Expense pages.
 * @param {Object} req
 * @param {Object} res
 */
function setCors(req, res) {
  const origin = String(req.get('origin') || '');
  if (ALLOWED_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

exports.expenseSession = onRequest({
  region: 'asia-southeast1',
  timeoutSeconds: 30,
  invoker: 'public',
}, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ok: false, error: 'Method Not Allowed'});
    return;
  }

  try {
    const body = req.body || {};
    const houseNo = normalizeHouseNo(body.houseNo);
    const pin = String(body.pin || '').trim();
    const authResponse = await fetch(ADMIN_ACCESS_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'resolve', houseNo, pin}),
      signal: AbortSignal.timeout(12000),
    });
    const authData = await authResponse.json().catch(() => ({}));
    const access = authData.access || {};
    if (!authResponse.ok || !authData.ok || !access.active ||
        !access.permissions?.['expense.view']) {
      res.status(authResponse.status === 404 ? 403 : 401).json({
        ok: false,
        error: 'Expense access denied',
      });
      return;
    }

    const role = access.permissions['expense.manage'] ?
      'superadmin' : 'committee';
    const uid = `expense-${houseNo.replace('/', '-')}`;
    const customToken = await admin.auth().createCustomToken(uid, {
      expenseRole: role,
      houseNo,
    });
    res.status(200).json({ok: true, customToken, role, houseNo});
  } catch (error) {
    logger.error('expenseSession failed', error);
    res.status(500).json({ok: false, error: 'Unable to create expense session'});
  }
});
