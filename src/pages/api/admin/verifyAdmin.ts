import type { NextApiRequest, NextApiResponse } from 'next';
import { verifySignature } from "thirdweb/auth";

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { wallet, signature, message } = req.body;

  if (!wallet || !signature || !message) {
    return res.status(400).json({ error: 'Missing authentication data' });
  }

  if (wallet.toLowerCase() !== ADMIN_WALLET) {
    return res.status(200).json({ isAdmin: false });
  }

  try {
    const isValid = await verifySignature({
      address: wallet,
      signature,
      message,
    });

    return res.status(200).json({ isAdmin: isValid });
  } catch (err) {
    return res.status(500).json({ error: 'Verification failed' });
  }
}