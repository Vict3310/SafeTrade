/**
 * KOVA Price Oracle Utility
 * Fetches real-time market data for Celo (CELO)
 */

export const PriceService = {
  /**
   * Fetches the current price of CELO in NGN
   * Uses CoinGecko public API
   */
  async getCeloPriceNGN(): Promise<number> {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=ngn');
      const data = await response.json();
      
      if (data && data.celo && data.celo.ngn) {
        return data.celo.ngn;
      }
      
      // Fallback to a safe historical constant if API fails
      console.warn("Price API failed, using fallback.");
      return 1350; 
    } catch (error) {
      console.error("Price Service Error:", error);
      return 1350; // Fallback
    }
  }
};
