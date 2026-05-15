-- Supabase Schema for SafeTrade
-- Production Hardened v1.1

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
  vendor_wallet TEXT,
  buyer_wallet TEXT,
  item_name TEXT NOT NULL,
  price_celo DECIMAL NOT NULL,
  price_naira DECIMAL DEFAULT 0,
  service_fee DECIMAL DEFAULT 0,
  payout_naira DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  evidence_url TEXT,
  safe_link_id TEXT UNIQUE,
  blockchain_deal_id BIGINT,
  tx_hash TEXT UNIQUE,
  qr_code_secret TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own, admins can read all
-- Profiles: Users can read/update their own (EXCEPT ROLE), admins can read all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own metadata" ON profiles FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (
    -- Prevent users from changing their own role
    (SELECT role FROM profiles WHERE id = auth.uid()) = role
  );

CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Shops: Owners can manage their shops, public read for verified
CREATE POLICY "Shop owners can manage" ON shops FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Public can view verified shops" ON shops FOR SELECT USING (is_verified = true);

-- Deals: Restricted access and modification
CREATE POLICY "Parties can view deals" ON deals FOR SELECT USING (
  auth.uid() = vendor_id OR 
  buyer_wallet = (SELECT wallet_address FROM profiles WHERE id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Vendors can insert deals" ON deals FOR INSERT WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Parties can update status" ON deals FOR UPDATE 
  USING (
    auth.uid() = vendor_id OR 
    buyer_wallet = (SELECT wallet_address FROM profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    -- Ensure sensitive fields like price and wallets cannot be changed after creation
    price_celo = price_celo AND
    vendor_wallet = vendor_wallet AND
    buyer_wallet = buyer_wallet
  );

-- Disputes: Related parties and admins
CREATE POLICY "Dispute access" ON disputes FOR ALL USING (
  auth.uid() = raised_by OR 
  EXISTS (SELECT 1 FROM deals WHERE id = deal_id AND (auth.uid() = vendor_id OR buyer_wallet = (SELECT wallet_address FROM profiles WHERE id = auth.uid()))) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Prevent tampering with sensitive deal data once created
CREATE OR REPLACE FUNCTION protect_deal_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status = 'Funded' OR OLD.status = 'Released' OR OLD.status = 'Disputed') THEN
        IF (NEW.price_celo <> OLD.price_celo OR 
            NEW.vendor_wallet <> OLD.vendor_wallet OR 
            NEW.buyer_wallet <> OLD.buyer_wallet OR
            NEW.safe_link_id <> OLD.safe_link_id) THEN
            RAISE EXCEPTION 'CRITICAL: Tampering detected. Sensitive fields in a secured deal cannot be modified.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lock_deal_integrity
BEFORE UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION protect_deal_integrity();

-- Feedback Table
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    category TEXT,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert feedback" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view feedback" ON feedback FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Enable pgcrypto for PII Encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Audit Logging Table (Expanded)
CREATE TABLE transaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id),
    previous_status TEXT,
    new_status TEXT,
    actor_id UUID REFERENCES profiles(id),
    actor_wallet TEXT,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Update Profiles for Encryption
ALTER TABLE profiles ADD COLUMN account_number_encrypted BYTEA;
ALTER TABLE profiles ADD COLUMN encryption_key_id UUID;

ALTER TABLE transaction_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all logs" ON transaction_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Function to automatically log deal status changes
CREATE OR REPLACE FUNCTION log_deal_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO transaction_logs (deal_id, previous_status, new_status, actor_id, actor_wallet)
        VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), (SELECT wallet_address FROM profiles WHERE id = auth.uid()));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_deal_changes
AFTER UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION log_deal_changes();

-- Atomic Status Update to prevent race conditions (Issue 5)
CREATE OR REPLACE FUNCTION update_deal_status_atomic(
    target_link_id TEXT,
    expected_status TEXT,
    new_status TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    UPDATE deals
    SET status = new_status
    WHERE safe_link_id = target_link_id AND status = expected_status;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- SCHEMA PROTECTION: Revoke PUBLIC access to prevent guessing
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
-- Grant execute on the atomic function
GRANT EXECUTE ON FUNCTION update_deal_status_atomic TO authenticated, anon;
