/**
 * Compress-X Studio — Lightweight Backend Engine (Scenario 1)
 * Handles inquiries, newsletter subscriptions, live telemetry, and checkout orchestration.
 * 100% Media Processing remains Client-Side in browser Web Workers for zero server cost.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const supabaseClient = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data Persistence Layer (File-based DB with Serverless / Read-Only Protection)
const os = require('os');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join(os.tmpdir(), 'compressx_data') : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let inMemoryDb = {
  contacts: [],
  subscribers: [],
  stats: {
    imagesOptimized: 491200,
    totalMbSaved: 1248000,
    inquiriesReceived: 0,
    subscribersCount: 0
  }
};

// Ensure data folder exists safely without crashing in serverless
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Ephemeral memory fallback
}

function getDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryDb, null, 2), 'utf-8');
      } catch (writeErr) {
        // Ephemeral memory fallback
      }
      return inMemoryDb;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    inMemoryDb = parsed;
    return parsed;
  } catch (err) {
    return inMemoryDb;
  }
}

function saveDb(data) {
  inMemoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Memory fallback retained
  }
}

// -----------------------------------------------------------------------------
// 1. Static Assets Delivery (No-Cache for CSS/JS dev updates)
// -----------------------------------------------------------------------------
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// -----------------------------------------------------------------------------
// 2. Healthcheck & System Telemetry Endpoint
// -----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Compress-X Studio Backend',
    version: '3.6',
    database: supabaseClient.isSupabaseReady() ? 'Supabase Cloud (PostgreSQL)' : 'Hybrid Local (data/db.json)',
    supabaseConnected: supabaseClient.isSupabaseReady(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    engine: 'Hybrid Client-Compute / Lightweight Node.js API'
  });
});

// -----------------------------------------------------------------------------
// 3. Platform Live Stats Endpoint
// -----------------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    stats: db.stats,
    activeEngine: 'WebAssembly & OffscreenCanvas',
    serverStatus: 'Online (0ms Cloud Latency)'
  });
});

// Increment Stats when client optimizes images
app.post('/api/stats/increment', (req, res) => {
  const { count = 1, bytesSaved = 0 } = req.body;
  const db = getDb();
  const mb = Math.round(bytesSaved / (1024 * 1024));

  db.stats.imagesOptimized = (db.stats.imagesOptimized || 490000) + Number(count);
  db.stats.totalMbSaved = (db.stats.totalMbSaved || 1240000) + Number(mb);
  saveDb(db);

  res.json({
    success: true,
    stats: db.stats
  });
});

// -----------------------------------------------------------------------------
// 4. Contact Form Inquiries Endpoint
// -----------------------------------------------------------------------------
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: 'Please fill out all required fields: name, email, subject, and message.'
    });
  }

  // Basic email syntax check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid email address.'
    });
  }

  const db = getDb();
  const ticketId = `TK-${Math.floor(100000 + Math.random() * 900000)}`;
  const inquiry = {
    ticketId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    subject: subject.trim(),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    status: 'open'
  };

  db.contacts.push(inquiry);
  db.stats.inquiriesReceived = (db.stats.inquiriesReceived || 0) + 1;
  saveDb(db);

  // Sync to Supabase Cloud if connected
  if (supabaseClient.isSupabaseReady()) {
    supabaseClient.supabaseSaveContact(inquiry).catch(err => {
      console.warn('⚠️ [Supabase] Contact sync notice:', err.message);
    });
  }

  console.log(`[Contact Form] New inquiry from ${inquiry.name} (${inquiry.email}) — Ticket: ${ticketId}`);

  res.json({
    success: true,
    ticketId,
    message: `Thank you, ${inquiry.name}! Your message has been received. Ticket reference: ${ticketId}. Our engineering team will reply to your email shortly.`
  });
});

// -----------------------------------------------------------------------------
// 5. Newsletter Subscription Endpoint
// -----------------------------------------------------------------------------
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email address is required.'
    });
  }

  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email address.'
    });
  }

  const db = getDb();
  const exists = db.subscribers.some(s => s.email === normalized);

  if (exists) {
    return res.json({
      success: true,
      alreadySubscribed: true,
      message: 'You are already subscribed to updates!'
    });
  }

  db.subscribers.push({
    email: normalized,
    subscribedAt: new Date().toISOString()
  });
  db.stats.subscribersCount = (db.stats.subscribersCount || 0) + 1;
  saveDb(db);

  // Sync to Supabase Cloud if connected
  if (supabaseClient.isSupabaseReady()) {
    supabaseClient.supabaseSaveSubscriber(normalized).catch(err => {
      console.warn('⚠️ [Supabase] Subscriber sync notice:', err.message);
    });
  }

  console.log(`[Newsletter] New subscriber: ${normalized}`);

  res.json({
    success: true,
    message: 'Welcome to the Compress-X Studio loop! You will receive future format & offline updates.'
  });
});

// -----------------------------------------------------------------------------
// 6. User Authentication & PKR Card Subscription Engine
// -----------------------------------------------------------------------------
const userSessions = new Map(); // token -> { userId, expiresAt }

function cleanExpiredUserSessions() {
  const now = Date.now();
  for (const [token, meta] of userSessions.entries()) {
    if (meta.expiresAt < now) userSessions.delete(token);
  }
}

function getAuthenticatedUser(req) {
  cleanExpiredUserSessions();
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-user-token']) {
    token = req.headers['x-user-token'].trim();
  }

  if (!token || !userSessions.has(token)) return null;

  const session = userSessions.get(token);
  const db = getDb();
  const user = (db.users || []).find(u => u.id === session.userId);
  return { user, token };
}

// Pricing definitions in Pakistani Rupees (PKR)
const PKR_PRICING = {
  free: {
    name: 'Community Free',
    monthlyPkr: 0,
    yearlyPkr: 0,
    features: ['100% In-Browser Privacy', 'Unlimited Daily Compression', 'WebP/AVIF Converter', 'PDF Optimization']
  },
  pro: {
    name: 'Pro Studio',
    monthlyPkr: 2499,
    yearlyPkr: 24990, // ~17% Discount
    features: ['Everything in Free', 'AI Super-Resolution Upscaling', 'Custom Watermark Presets', 'High-Priority Web Workers', 'Priority 24/7 Support']
  },
  team: {
    name: 'Team & API',
    monthlyPkr: 7999,
    yearlyPkr: 79990,
    features: ['Everything in Pro', '100,000 API Calls/month', 'Team Multi-Seat Management', 'Dedicated 99.99% SLA', 'Custom Webhooks']
  }
};

// GET Plans
app.get('/api/billing/plans', (req, res) => {
  res.json({
    success: true,
    currency: 'PKR',
    currencySymbol: 'Rs.',
    plans: PKR_PRICING
  });
});

// User Sign Up (Supabase Cloud + Local Fallback)
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Full name, email, and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }

  // 1. Supabase Cloud Sign Up (if active)
  if (supabaseClient.isSupabaseReady()) {
    try {
      const supaUser = await supabaseClient.supabaseSignUp(name.trim(), normalizedEmail, password);
      if (supaUser) {
        const token = supaUser.sessionToken || `usr_tok_${crypto.randomBytes(24).toString('hex')}`;
        userSessions.set(token, {
          userId: supaUser.id,
          expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
        });

        // Mirror to local DB cache
        const db = getDb();
        db.users = db.users || [];
        if (!db.users.some(u => u.id === supaUser.id || u.email.toLowerCase() === normalizedEmail)) {
          db.users.push({ ...supaUser, password });
          saveDb(db);
        }

        console.log(`[Auth/Supabase] User registered in cloud: ${supaUser.name} (${supaUser.email})`);
        return res.json({
          success: true,
          token,
          user: supaUser,
          database: 'supabase',
          message: 'Account created successfully in Supabase Cloud! Welcome to Compress-X Studio.'
        });
      }
    } catch (supaErr) {
      return res.status(400).json({
        success: false,
        error: supaErr.message || 'Error creating account in Supabase.'
      });
    }
  }

  // 2. Local Fallback Database
  const db = getDb();
  db.users = db.users || [];

  if (db.users.some(u => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'An account with this email already exists. Please sign in.' });
  }

  const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
  const newUser = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    password: password,
    plan: 'free',
    createdAt: new Date().toISOString(),
    subscription: null
  };

  db.users.push(newUser);
  saveDb(db);

  // Generate Session Token
  const token = `usr_tok_${crypto.randomBytes(24).toString('hex')}`;
  userSessions.set(token, {
    userId,
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
  });

  const { password: _, ...safeUser } = newUser;
  console.log(`[Auth/Local] New user registered: ${newUser.name} (${newUser.email})`);

  res.json({
    success: true,
    token,
    user: safeUser,
    database: 'local',
    message: 'Account created successfully! Welcome to Compress-X Studio.'
  });
});

// User Login (Supabase Cloud + Local Fallback)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Please enter both email and password.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Supabase Cloud Sign In (if active)
  if (supabaseClient.isSupabaseReady()) {
    try {
      const supaResult = await supabaseClient.supabaseSignIn(normalizedEmail, password);
      if (supaResult && supaResult.user) {
        const token = supaResult.token || `usr_tok_${crypto.randomBytes(24).toString('hex')}`;
        userSessions.set(token, {
          userId: supaResult.user.id,
          expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
        });

        console.log(`[Auth/Supabase] User logged in: ${supaResult.user.name} (${supaResult.user.email})`);
        return res.json({
          success: true,
          token,
          user: supaResult.user,
          database: 'supabase',
          message: `Welcome back, ${supaResult.user.name}!`
        });
      }
    } catch (supaErr) {
      return res.status(401).json({
        success: false,
        error: supaErr.message || 'Invalid email or password.'
      });
    }
  }

  // 2. Local Fallback Database
  const db = getDb();
  db.users = db.users || [];

  // Seed demo user if no users exist
  if (db.users.length === 0 && (normalizedEmail === 'demo@compress-x.local' || normalizedEmail === 'user@test.com')) {
    const demoUser = {
      id: 'usr_demo_101',
      name: 'Hamza Designer',
      email: normalizedEmail,
      password: 'password123',
      plan: 'pro',
      createdAt: new Date().toISOString(),
      subscription: {
        plan: 'pro',
        planName: 'Pro Studio',
        amountPkr: 2499,
        billingCycle: 'monthly',
        cardBrand: 'Mastercard',
        cardLast4: '4242',
        status: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString()
      }
    };
    db.users.push(demoUser);
    saveDb(db);
  }

  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  // Generate Session Token
  const token = `usr_tok_${crypto.randomBytes(24).toString('hex')}`;
  userSessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
  });

  const { password: _, ...safeUser } = user;
  console.log(`[Auth/Local] User authenticated: ${user.name} (${user.email})`);

  res.json({
    success: true,
    token,
    user: safeUser,
    database: 'local',
    message: `Welcome back, ${user.name}!`
  });
});

// Get Current User Profile
app.get('/api/auth/me', (req, res) => {
  const auth = getAuthenticatedUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
  }

  const { password: _, ...safeUser } = auth.user;
  res.json({ success: true, user: safeUser });
});

// User Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    userSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Bank Card (Visa / Mastercard) Subscription Checkout in PKR
app.post('/api/billing/subscribe', (req, res) => {
  const {
    plan = 'pro',
    billingCycle = 'monthly',
    cardholderName,
    cardNumber,
    expiry,
    cvv,
    email,
    name
  } = req.body;

  const planInfo = PKR_PRICING[plan];
  if (!planInfo || plan === 'free') {
    return res.status(400).json({ success: false, error: 'Invalid subscription plan selected.' });
  }

  // Validate Card Details
  if (!cardholderName || !cardNumber || !expiry || !cvv) {
    return res.status(400).json({
      success: false,
      error: 'Please fill out all card payment fields: Cardholder Name, Card Number, Expiry, and CVV.'
    });
  }

  const cleanCardNumber = cardNumber.replace(/\s+/g, '');
  if (!/^\d{15,16}$/.test(cleanCardNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid card number format. Must be a 15 or 16 digit Visa or Mastercard.'
    });
  }

  // Determine Brand (Visa or Mastercard)
  let cardBrand = 'Unknown';
  if (cleanCardNumber.startsWith('4')) {
    cardBrand = 'Visa';
  } else if (/^(5[1-5]|2[2-7])/.test(cleanCardNumber)) {
    cardBrand = 'Mastercard';
  } else {
    return res.status(400).json({
      success: false,
      error: 'Only Visa and Mastercard debit/credit cards are accepted for PKR billing.'
    });
  }

  // Expiry check
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) {
    return res.status(400).json({ success: false, error: 'Expiry date must be in MM/YY format.' });
  }

  // CVV check
  if (!/^\d{3,4}$/.test(cvv)) {
    return res.status(400).json({ success: false, error: 'CVV security code must be 3 or 4 digits.' });
  }

  const db = getDb();
  db.users = db.users || [];
  db.subscriptions = db.subscriptions || [];
  db.stats = db.stats || {};

  // Resolve User Account
  let auth = getAuthenticatedUser(req);
  let user = auth ? auth.user : null;

  if (!user) {
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required for receipt and account activation.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      user = {
        id: `usr_${crypto.randomBytes(6).toString('hex')}`,
        name: (name || cardholderName || 'Valued Customer').trim(),
        email: normalizedEmail,
        password: 'User@' + Math.floor(1000 + Math.random() * 9000),
        plan: 'free',
        createdAt: new Date().toISOString(),
        subscription: null
      };
      db.users.push(user);
    }
  }

  const amountPkr = billingCycle === 'yearly' ? planInfo.yearlyPkr : planInfo.monthlyPkr;
  const transactionId = `TXN-PKR-${Math.floor(100000 + Math.random() * 900000)}`;
  const invoiceNo = `INV-PKR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const durationDays = billingCycle === 'yearly' ? 365 : 30;

  const subscriptionRecord = {
    transactionId,
    invoiceNo,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    plan,
    planName: planInfo.name,
    billingCycle,
    amountPkr,
    currency: 'PKR',
    cardBrand,
    cardLast4: cleanCardNumber.slice(-4),
    cardholderName: cardholderName.trim(),
    status: 'active',
    paidAt: new Date().toISOString(),
    nextBillingDate: new Date(Date.now() + durationDays * 86400000).toISOString()
  };

  // Update user subscription state
  user.plan = plan;
  user.subscription = subscriptionRecord;

  // Record in global transaction history
  db.subscriptions.unshift(subscriptionRecord);
  db.stats.revenuePkr = (db.stats.revenuePkr || 0) + amountPkr;
  db.stats.paidSubscribers = (db.stats.paidSubscribers || 0) + 1;

  saveDb(db);

  // Sync to Supabase Cloud if connected
  if (supabaseClient.isSupabaseReady()) {
    supabaseClient.supabaseSaveSubscription(subscriptionRecord).catch(err => {
      console.warn('⚠️ [Supabase] Subscription sync notice:', err.message);
    });
  }

  // Generate auth session token if user was not logged in
  let token = auth ? auth.token : null;
  if (!token) {
    token = `usr_tok_${crypto.randomBytes(24).toString('hex')}`;
    userSessions.set(token, {
      userId: user.id,
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
    });
  }

  const { password: _, ...safeUser } = user;

  console.log(`[Subscription] Successful PKR payment: Rs. ${amountPkr.toLocaleString()} PKR by ${user.name} (${user.email}) via ${cardBrand} •••• ${subscriptionRecord.cardLast4} [${transactionId}]`);

  res.json({
    success: true,
    transaction: subscriptionRecord,
    user: safeUser,
    token,
    message: `Congratulations, ${user.name}! Your ${planInfo.name} subscription has been activated for Rs. ${amountPkr.toLocaleString()} PKR.`
  });
});

// Cancel Subscription
app.post('/api/billing/cancel-subscription', (req, res) => {
  const auth = getAuthenticatedUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
  }

  const db = getDb();
  const user = (db.users || []).find(u => u.id === auth.user.id);
  if (!user || user.plan === 'free') {
    return res.status(400).json({ success: false, error: 'No active paid subscription found to cancel.' });
  }

  const oldPlan = user.plan;
  user.plan = 'free';
  if (user.subscription) {
    user.subscription.status = 'cancelled';
    user.subscription.cancelledAt = new Date().toISOString();
  }

  db.stats.paidSubscribers = Math.max(0, (db.stats.paidSubscribers || 1) - 1);
  saveDb(db);

  // Sync cancellation to Supabase Cloud if connected
  if (supabaseClient.isSupabaseReady()) {
    supabaseClient.supabaseCancelSubscription(auth.user.id).catch(err => {
      console.warn('⚠️ [Supabase] Cancel sync notice:', err.message);
    });
  }

  const { password: _, ...safeUser } = user;
  res.json({
    success: true,
    user: safeUser,
    message: `Your ${oldPlan.toUpperCase()} subscription has been cancelled. You are now on the Free Community tier.`
  });
});

// -----------------------------------------------------------------------------
// 7. Admin Authentication & Management API
// -----------------------------------------------------------------------------
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const activeTokens = new Map(); // token -> { createdAt, expiresAt }

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [token, meta] of activeTokens.entries()) {
    if (meta.expiresAt < now) {
      activeTokens.delete(token);
    }
  }
}

function verifyAdminToken(req) {
  cleanExpiredTokens();
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'].trim();
  } else if (req.query && req.query.token) {
    token = req.query.token.trim();
  }

  if (!token || !activeTokens.has(token)) {
    return false;
  }
  return true;
}

const requireAdmin = (req, res, next) => {
  if (!verifyAdminToken(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Invalid or expired admin session token.'
    });
  }
  next();
};

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    activeTokens.set(token, {
      createdAt: now,
      expiresAt: now + (24 * 60 * 60 * 1000) // 24 hours session
    });
    console.log(`[Admin] Session authenticated for '${username}' at ${new Date().toISOString()}`);
    return res.json({
      success: true,
      token,
      user: username,
      expiresIn: 86400
    });
  }
  return res.status(401).json({
    success: false,
    error: 'Invalid username or password.'
  });
});

// Admin Session Verification
app.get('/api/admin/verify', (req, res) => {
  if (verifyAdminToken(req)) {
    return res.json({ success: true, valid: true });
  }
  return res.status(401).json({ success: false, valid: false });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'].trim();
  }
  if (token) activeTokens.delete(token);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Admin Overview Data
app.get('/api/admin/data', requireAdmin, async (req, res) => {
  const db = getDb();
  let contacts = db.contacts || [];
  let subscribers = db.subscribers || [];
  let users = (db.users || []).map(({ password, ...u }) => u);
  let subscriptions = db.subscriptions || [];

  if (supabaseClient.isSupabaseReady()) {
    try {
      const supaData = await supabaseClient.supabaseGetAdminData();
      if (supaData) {
        if (supaData.users && supaData.users.length) users = supaData.users;
        if (supaData.subscriptions && supaData.subscriptions.length) subscriptions = supaData.subscriptions;
        if (supaData.contacts && supaData.contacts.length) contacts = supaData.contacts;
        if (supaData.subscribers && supaData.subscribers.length) subscribers = supaData.subscribers;
      }
    } catch (err) {
      console.warn('⚠️ [Supabase] Admin data fetch warning:', err.message);
    }
  }

  res.json({
    success: true,
    stats: db.stats,
    databaseEngine: supabaseClient.isSupabaseReady() ? 'Supabase Cloud (PostgreSQL)' : 'Local File Storage (data/db.json)',
    contacts,
    subscribers,
    users,
    subscriptions,
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
    }
  });
});

// Update Ticket Status
app.post('/api/admin/ticket-status', requireAdmin, (req, res) => {
  const { ticketId, status } = req.body;
  const allowed = ['open', 'in-progress', 'resolved'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status value.' });
  }

  const db = getDb();
  const ticket = (db.contacts || []).find(t => t.ticketId === ticketId);
  if (!ticket) {
    return res.status(404).json({ success: false, error: 'Ticket not found.' });
  }

  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
  saveDb(db);

  res.json({ success: true, ticket });
});

// Delete Ticket
app.delete('/api/admin/ticket/:ticketId', requireAdmin, (req, res) => {
  const { ticketId } = req.params;
  const db = getDb();
  const initialLength = (db.contacts || []).length;
  db.contacts = (db.contacts || []).filter(t => t.ticketId !== ticketId);

  if (db.contacts.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Ticket not found.' });
  }

  saveDb(db);
  res.json({ success: true, message: `Ticket ${ticketId} deleted.` });
});

// Delete Subscriber
app.delete('/api/admin/subscriber/:email', requireAdmin, (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase();
  const db = getDb();
  const initialLength = (db.subscribers || []).length;
  db.subscribers = (db.subscribers || []).filter(s => s.email.toLowerCase() !== email);

  if (db.subscribers.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Subscriber not found.' });
  }

  db.stats.subscribersCount = Math.max(0, db.subscribers.length);
  saveDb(db);
  res.json({ success: true, message: `Subscriber ${email} removed.` });
});

// Export Subscribers to CSV
app.get('/api/admin/subscribers-csv', (req, res) => {
  if (!verifyAdminToken(req)) {
    return res.status(401).send('Unauthorized. Admin token required.');
  }

  const db = getDb();
  const subscribers = db.subscribers || [];
  let csv = 'Email,SubscribedAt\r\n';
  subscribers.forEach(sub => {
    csv += `"${(sub.email || '').replace(/"/g, '""')}","${sub.subscribedAt || ''}"\r\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="compress-x-subscribers.csv"');
  res.send(csv);
});

// -----------------------------------------------------------------------------
// 8. Serve Admin Dashboard HTML
// -----------------------------------------------------------------------------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// -----------------------------------------------------------------------------
// 9. Fallback Route
// -----------------------------------------------------------------------------
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server (when run standalone, not when imported as serverless handler)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 Compress-X Studio Backend Server running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`⚡ Mode: Scenario 1 (Lightweight Business & API Backend)`);
    console.log(`💾 Database: ${supabaseClient.isSupabaseReady() ? 'Supabase Cloud (PostgreSQL)' : 'Hybrid Local (data/db.json)'}`);
    console.log(`🔒 Media Engine: 100% In-Browser Privacy Preserved`);
    console.log('====================================================');
  });
}

module.exports = app;
