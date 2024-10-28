import { DevconTicketSpec } from "@/lib/ticketSchema";
import { POD } from "@pcd/pod";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { serializedTicket, serializedProofOfIdentity } = await req.json();
  const ticketPOD = POD.fromJSON(serializedTicket);
  const proofOfIdentityPOD = POD.fromJSON(serializedProofOfIdentity);

  let verified = false;
  try {
    const valid = ticketPOD.verifySignature();
    if (valid) {
      const { isValid } = DevconTicketSpec.safeParse(ticketPOD);
      verified = isValid;
    }
    if (verified) {
      verified =
        proofOfIdentityPOD.signerPublicKey ===
        ticketPOD.content.asEntries().owner.value &&
        proofOfIdentityPOD.content.asEntries()._UNSAFE_ticketId.value ===
          ticketPOD.content.asEntries().ticketId.value;
    }
  } catch (e) {
    console.error(e);
    verified = false;
  }

  return NextResponse.json({ verified });
}
