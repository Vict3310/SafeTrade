-- Supabase Schema for SafeTrade

-- Profiles table (Buyer/Vendor info)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  phone_number TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'client',
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Shops table (Vendor details)
CREATE TABLE shops (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  is_verified BOOLEAN DEFAULT false,
  reputation_score DECIMAL DEFAULT 100.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Deals table (Off-chain metadata)
CREATE TABLE deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  price_celo DECIMAL NOT NULL,
  status TEXT DEFAULT 'Pending',
  evidence_url TEXT,
  safe_link_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disputes table
CREATE TABLE disputes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  raised_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  evidence_notes TEXT,
  status TEXT DEFAULT 'Open',
  admin_notes TEXT,
  winner_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SECURITY POLICIES (RLS)
-- Note: In production, these should be restricted to authenticated users.

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Allow public access for testing
CREATE POLICY "Public Profiles Access" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public Shops Access" ON shops FOR SELECT USING (true);
CREATE POLICY "Public Deals Access" ON deals FOR ALL USING (true);
CREATE POLICY "Public Disputes Access" ON disputes FOR ALL USING (true);
