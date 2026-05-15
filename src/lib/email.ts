/**
 * KOVA Email Service
 * Production-ready email notifications for platform events.
 * Recommended: Integration with Resend, Postmark, or SendGrid.
 */

export const EmailService = {
  /**
   * Notify Admin of a new dispute
   */
  async notifyDisputeRaised(data: { 
    dealId: string; 
    reason: string; 
    itemName: string; 
    amount: number;
    buyerWallet: string;
  }) {
    console.log("📧 [EMAIL SERVICE] Triggering Dispute Alert...", data);
    
    if (!process.env.RESEND_API_KEY) {
      console.warn("⚠️ RESEND_API_KEY missing. Skipping email.");
      return false;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'KOVA Vault <alerts@kova.com>',
          to: ['admin@kova.com'], 
          subject: `🚨 DISPUTE RAISED: ${data.itemName}`,
          html: `
            <div style="font-family: sans-serif; background: #000; color: #fff; padding: 40px; border: 1px solid #333;">
              <h1 style="text-transform: uppercase; letter-spacing: 0.2em; border-bottom: 1px solid #0047FF; padding-bottom: 20px;">K O V A .</h1>
              <p style="opacity: 0.6; text-transform: uppercase; font-size: 10px; font-weight: bold; margin-bottom: 30px;">Dispute Notification Protocol v1.0</p>
              <h2 style="font-size: 24px; margin-bottom: 20px;">🚨 Dispute Raised for ${data.itemName}</h2>
              <div style="background: rgba(255,255,255,0.05); padding: 20px; border-left: 4px solid #0047FF; margin-bottom: 30px;">
                <p><strong>Deal ID:</strong> ${data.dealId}</p>
                <p><strong>Amount:</strong> ₦${data.amount.toLocaleString()}</p>
                <p><strong>Buyer Wallet:</strong> ${data.buyerWallet}</p>
              </div>
              <div style="background: rgba(255,0,0,0.1); padding: 20px; border: 1px solid rgba(255,0,0,0.2); margin-bottom: 30px;">
                <p style="font-size: 12px; text-transform: uppercase; color: #ff0000; font-weight: bold; margin-bottom: 10px;">REASON GIVEN:</p>
                <p style="font-style: italic;">"${data.reason}"</p>
              </div>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin" style="display: inline-block; background: #0047FF; color: #fff; text-decoration: none; padding: 15px 30px; font-weight: bold; text-transform: uppercase; font-size: 12px;">Go to Arbitration Center</a>
            </div>
          `,
        }),
      });
      return response.ok;
    } catch (err) {
      console.error("Email delivery failed:", err);
      return false;
    }
  },

  /**
   * Notify Admin of a successful fund release (Revenue tracking)
   */
  async notifyFundsReleased(data: {
    dealId: string;
    itemName: string;
    amount: number;
    fee: number;
  }) {
    console.log("💰 [EMAIL SERVICE] Triggering Revenue Alert...", data);
    
    if (!process.env.RESEND_API_KEY) return false;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'KOVA Vault <revenue@kova.com>',
          to: ['admin@kova.com'],
          subject: `💰 REVENUE COLLECTED: ${data.itemName}`,
          html: `
            <div style="font-family: sans-serif; background: #000; color: #fff; padding: 40px;">
              <h1 style="text-transform: uppercase; letter-spacing: 0.2em; border-bottom: 1px solid #0047FF;">K O V A .</h1>
              <h2 style="font-size: 24px;">Revenue Event Recorded</h2>
              <p>Deal ${data.dealId} has been successfully released.</p>
              <div style="background: rgba(255,255,255,0.05); padding: 20px; border-left: 4px solid #00C853;">
                <p><strong>Total Value:</strong> ₦${data.amount.toLocaleString()}</p>
                <p><strong>Protocol Fee (1.5%):</strong> ₦${data.fee.toLocaleString()}</p>
              </div>
            </div>
          `
        }),
      });
      return true;
    } catch (err) {
      return false;
    }
  }
};
