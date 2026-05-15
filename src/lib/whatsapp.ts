export const WhatsAppService = {
  generateMessage: (type: 'funded' | 'released' | 'disputed', data: { itemName: string, amount: number, id: string }) => {
    const baseUrl = "https://wa.me/";
    const origin = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "";
    let text = "";

    switch (type) {
      case 'funded':
        text = `🚀 *SafeTrade Update: Deal Funded!*\n\nGood news! The buyer has secured ₦${data.amount.toLocaleString()} for *${data.itemName}* (ID: ${data.id.slice(0,8)}).\n\nFunds are now locked in the SafeVault. You can proceed with the handover.\n\nView Deal: ${origin}/deal/${data.id}`;
        break;
      case 'released':
        text = `✅ *SafeTrade Update: Funds Released!*\n\nSuccess! ₦${data.amount.toLocaleString()} has been released to the vendor for *${data.itemName}*.\n\nThank you for using SafeTrade - the trust layer of Computer Village.\n\nView Receipt: ${origin}/deal/${data.id}`;
        break;
      case 'disputed':
        text = `⚠️ *SafeTrade Alert: Dispute Raised!*\n\nA dispute has been raised for the deal *${data.itemName}* (ID: ${data.id.slice(0,8)}).\n\nFunds are currently frozen in the vault pending admin review.\n\nCase Details: ${origin}/deal/${data.id}`;
        break;
    }

    return `${baseUrl}?text=${encodeURIComponent(text)}`;
  },

  sendUpdate: (type: 'funded' | 'released' | 'disputed', data: { itemName: string, amount: number, id: string }) => {
    if (typeof window === 'undefined') return;
    const url = WhatsAppService.generateMessage(type, data);
    window.open(url, '_blank');
  }
};
