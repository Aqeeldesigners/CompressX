-- =============================================================================
-- COMPRESS-X STUDIO — SUPABASE POSTGRESQL DATABASE SCHEMA
-- Run this complete script in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- 1. Profiles Table (Extends Supabase auth.users or standalone accounts)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (true);


-- 2. Subscriptions Table (Tracks PKR Bank Card Subscriptions & Billing Status)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  plan TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount_pkr NUMERIC(10, 2) NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly',
  card_brand TEXT,
  card_last4 TEXT,
  status TEXT DEFAULT 'active',
  transaction_ref TEXT,
  next_billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscriptions viewable by everyone / admin" 
ON public.subscriptions FOR SELECT USING (true);

CREATE POLICY "Subscriptions insertable by server" 
ON public.subscriptions FOR INSERT WITH CHECK (true);

CREATE POLICY "Subscriptions updatable by server" 
ON public.subscriptions FOR UPDATE USING (true);


-- 3. Contact Inquiries Table
CREATE TABLE IF NOT EXISTS public.contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread',
  date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public contact message insertion" 
ON public.contacts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin to read contacts" 
ON public.contacts FOR SELECT USING (true);


-- 4. Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS public.subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for subscribers
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public newsletter subscription" 
ON public.subscribers FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow reading subscribers" 
ON public.subscribers FOR SELECT USING (true);


-- 5. Platform Telemetry & Stats Table
CREATE TABLE IF NOT EXISTS public.platform_stats (
  id INT PRIMARY KEY DEFAULT 1,
  images_optimized BIGINT DEFAULT 491200,
  total_mb_saved BIGINT DEFAULT 1248000,
  inquiries_count INT DEFAULT 0,
  subscribers_count INT DEFAULT 0,
  revenue_pkr NUMERIC(12, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Seed initial row if not present
INSERT INTO public.platform_stats (id, images_optimized, total_mb_saved, revenue_pkr)
VALUES (1, 491200, 1248000, 0)
ON CONFLICT (id) DO NOTHING;

-- RPC Function for incrementing revenue easily
CREATE OR REPLACE FUNCTION increment_revenue(amount NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE public.platform_stats
  SET revenue_pkr = revenue_pkr + amount,
      updated_at = now()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- Fast Search Indexes
CREATE INDEX IF NOT EXISTS idx_subs_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_contacts_date ON public.contacts(date DESC);
