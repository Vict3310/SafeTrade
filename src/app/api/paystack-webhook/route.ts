import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: 'Config missing' }, { status: 500 });

  const body = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  // 1. SIGNATURE CHECK: Prevent unauthorized spoofing
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
  if (hash !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === 'charge.success') {
    const { reference, metadata } = event.data;
    const dealId = metadata?.deal_id;

    if (!dealId) return NextResponse.json({ status: 'No deal ID' });

    // 2. VERIFICATION LOOP: Call Paystack directly to confirm truth
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const verifyData = await verifyRes.json();

    if (verifyData.status && verifyData.data.status === 'success') {
      const paidAmount = verifyData.data.amount; // In kobo

      // Fetch deal to verify amount
      const { data: deal, error: fetchError } = await supabase
        .from('deals')
        .select('price_naira, status')
        .eq('id', dealId)
        .single();

      if (fetchError || !deal) {
        return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
      }

      // 3. AMOUNT VERIFICATION (Issue 6): Prevent underpayment attacks
      const expectedAmount = Math.round(deal.price_naira * 100); // Convert to kobo
      if (paidAmount < expectedAmount) {
        console.error(`🚨 Underpayment detected for deal ${dealId}. Paid: ${paidAmount}, Expected: ${expectedAmount}`);
        return NextResponse.json({ error: 'Underpayment' }, { status: 400 });
      }

      // 4. IDEMPOTENCY: Only update if status is Pending
      if (deal.status === 'Pending') {
        const { error } = await supabase
          .from('deals')
          .update({ status: 'Funded', tx_hash: reference })
          .eq('id', dealId);

        if (error) console.error("Webhook Update Error:", error);
      }
    }
  }

  return NextResponse.json({ status: 'Success' });
}
