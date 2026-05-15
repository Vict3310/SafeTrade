import { createThirdwebClient } from "thirdweb";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
  throw new Error("CRITICAL: NEXT_PUBLIC_THIRDWEB_CLIENT_ID is missing.");
}

export const client = createThirdwebClient({
  clientId,
});
