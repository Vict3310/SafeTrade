import type { NextApiRequest, NextApiResponse } from 'next';
import { verifySignature } from "thirdweb/auth";
import { createClient } from '@supabase/supabase-js';

// Server-side supabase client with SERVICE ROLE for secure mutation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { dealId, signature, message, wallet } = req.body;

  if (!dealId || !signature || !message || !wallet) {
    return res.status(400).json({ error: 'Missing authentication data' });
  }

  try {
    // 1. VERIFY SIGNATURE: Ensure the caller owns the wallet
    const isValid = await verifySignature({
      address: wallet,
      signature,
      message,
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. FETCH DEAL & VERIFY OWNERSHIP
    const { data: deal, error: fetchError } = await supabase
      .from('deals')
      .select('buyer_wallet, status')
      .eq('safe_link_id', dealId)
      .single();

    if (fetchError || !deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only the buyer can release funds
    if (deal.buyer_wallet?.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized: Only the buyer can release funds' });
    }

    // 3. ATOMIC UPDATE VIA RPC
    const { data: success, error: rpcError } = await supabase.rpc('update_deal_status_atomic', {
      target_link_id: dealId,
      expected_status: 'Funded',
      new_status: 'Released'
    });

    if (rpcError || !success) {
      return res.status(500).json({ error: rpcError?.message || 'Update failed' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Release API Error:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
