/**
 * Compress-X Studio — Supabase Cloud Database & Auth Engine
 * Seamlessly connects to PostgreSQL on Supabase Cloud.
 * Automatically falls back to local data/db.json if credentials are not provided.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase = null;
let isConfigured = false;

// Validate that Supabase URL and Key are real (not defaults/placeholders)
if (
  SUPABASE_URL &&
  SUPABASE_KEY &&
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_KEY.includes('your-anon-key')
) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    isConfigured = true;
    console.log('⚡ [Supabase] Connected successfully to Cloud Database:', SUPABASE_URL);
  } catch (err) {
    console.error('⚠️ [Supabase] Initialization error:', err.message);
    isConfigured = false;
  }
} else {
  console.log('ℹ️ [Supabase] No active cloud credentials found in .env. Running in Hybrid Local Mode (data/db.json).');
  console.log('👉 To connect Supabase, open .env and paste your SUPABASE_URL and SUPABASE_ANON_KEY.');
}

function isSupabaseReady() {
  return isConfigured && supabase !== null;
}

/**
 * Register a user via Supabase
 */
async function supabaseSignUp(name, email, password) {
  if (!isSupabaseReady()) return null;

  try {
    // 1. Register with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (authError) throw authError;

    const user = authData.user;
    if (!user) throw new Error('Could not create user account.');

    // 2. Insert profile record into 'profiles' table
    const profile = {
      id: user.id,
      name,
      email,
      plan: 'free',
      created_at: new Date().toISOString()
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profile, { onConflict: 'id' });

    if (profileError) {
      console.warn('⚠️ [Supabase] Profile insert note:', profileError.message);
    }

    return {
      id: user.id,
      name,
      email,
      plan: 'free',
      createdAt: profile.created_at,
      sessionToken: authData.session ? authData.session.access_token : null
    };
  } catch (err) {
    console.error('❌ [Supabase] Sign up error:', err.message);
    throw err;
  }
}

/**
 * Sign in a user via Supabase
 */
async function supabaseSignIn(email, password) {
  if (!isSupabaseReady()) return null;

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) throw authError;
    const user = authData.user;

    // Fetch user profile & latest subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      user: {
        id: user.id,
        name: (profile && profile.name) || user.user_metadata?.name || 'User',
        email: user.email,
        plan: (profile && profile.plan) || 'free',
        createdAt: (profile && profile.created_at) || user.created_at,
        subscription: subscription || null
      },
      token: authData.session ? authData.session.access_token : null
    };
  } catch (err) {
    console.error('❌ [Supabase] Sign in error:', err.message);
    throw err;
  }
}

/**
 * Save / Activate a Subscription in Supabase
 */
async function supabaseSaveSubscription(sub) {
  if (!isSupabaseReady()) return null;

  try {
    // 1. Insert into subscriptions table
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        id: sub.id,
        user_id: sub.userId,
        user_email: sub.userEmail,
        plan: sub.plan,
        plan_name: sub.planName,
        amount_pkr: sub.amountPkr,
        billing_cycle: sub.billingCycle,
        card_brand: sub.cardBrand,
        card_last4: sub.cardLast4,
        status: 'active',
        transaction_ref: sub.transactionRef,
        next_billing_date: sub.nextBillingDate,
        created_at: sub.createdAt || new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Update user's profile plan
    await supabase
      .from('profiles')
      .update({ plan: sub.plan })
      .eq('id', sub.userId);

    // 3. Increment revenue in platform_stats
    await supabase.rpc('increment_revenue', { amount: sub.amountPkr }).catch(() => {
      // Fallback if RPC is not defined
    });

    return data;
  } catch (err) {
    console.error('❌ [Supabase] Save subscription error:', err.message);
    throw err;
  }
}

/**
 * Cancel an active subscription in Supabase
 */
async function supabaseCancelSubscription(userId) {
  if (!isSupabaseReady()) return null;

  try {
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'active');

    await supabase
      .from('profiles')
      .update({ plan: 'free' })
      .eq('id', userId);

    return true;
  } catch (err) {
    console.error('❌ [Supabase] Cancel subscription error:', err.message);
    throw err;
  }
}

/**
 * Save Contact Inquiry in Supabase
 */
async function supabaseSaveContact(contact) {
  if (!isSupabaseReady()) return null;

  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        message: contact.message,
        date: contact.date || new Date().toISOString(),
        status: contact.status || 'unread'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('❌ [Supabase] Contact save error:', err.message);
    throw err;
  }
}

/**
 * Save Newsletter Subscriber in Supabase
 */
async function supabaseSaveSubscriber(email) {
  if (!isSupabaseReady()) return null;

  try {
    const { data, error } = await supabase
      .from('subscribers')
      .upsert(
        { email, subscribed_at: new Date().toISOString() },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('❌ [Supabase] Newsletter save error:', err.message);
    throw err;
  }
}

/**
 * Fetch all records for the Admin Control Center
 */
async function supabaseGetAdminData() {
  if (!isSupabaseReady()) return null;

  try {
    const [profilesRes, subsRes, contactsRes, subscribersRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').order('date', { ascending: false }),
      supabase.from('subscribers').select('*').order('subscribed_at', { ascending: false })
    ]);

    const users = (profilesRes.data || []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      plan: p.plan,
      createdAt: p.created_at
    }));

    const subscriptions = (subsRes.data || []).map((s) => ({
      id: s.id,
      userId: s.user_id,
      userEmail: s.user_email,
      plan: s.plan,
      planName: s.plan_name,
      amountPkr: s.amount_pkr,
      billingCycle: s.billing_cycle,
      cardBrand: s.card_brand,
      cardLast4: s.card_last4,
      status: s.status,
      transactionRef: s.transaction_ref,
      createdAt: s.created_at,
      nextBillingDate: s.next_billing_date
    }));

    const totalRevenuePkr = subscriptions.reduce((sum, s) => sum + (Number(s.amountPkr) || 0), 0);

    return {
      users,
      subscriptions,
      contacts: contactsRes.data || [],
      subscribers: subscribersRes.data || [],
      totalRevenuePkr
    };
  } catch (err) {
    console.error('❌ [Supabase] Admin data fetch error:', err.message);
    throw err;
  }
}

module.exports = {
  supabase,
  isSupabaseReady,
  supabaseSignUp,
  supabaseSignIn,
  supabaseSaveSubscription,
  supabaseCancelSubscription,
  supabaseSaveContact,
  supabaseSaveSubscriber,
  supabaseGetAdminData
};
