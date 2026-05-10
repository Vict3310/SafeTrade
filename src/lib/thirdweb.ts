import { createThirdwebClient } from "thirdweb";

// Replace this with your actual Thirdweb Client ID from the dashboard
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "YOUR_DUMMY_CLIENT_ID";

export const client = createThirdwebClient({
  clientId,
});
