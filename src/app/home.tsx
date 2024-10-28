"use client";

import {
  ClientConnectionState,
  ParcnetClientProvider,
  Toolbar,
  useParcnetClient,
} from "@parcnet-js/app-connector-react";
import { useState, useCallback, useMemo } from "react";
import { DevconTicketSpec } from "@/lib/ticketSchema";
import { PODData } from "@parcnet-js/podspec";
import { POD } from "@pcd/pod";

export default function Home() {
  return (
    <ParcnetClientProvider
      zapp={{
        name: "Auth Test",
        permissions: {
          READ_POD: { collections: ["Devcon SEA"] },
          SIGN_POD: {},
          READ_PUBLIC_IDENTIFIERS: {},
        },
      }}
    >
      <Toolbar />

      <RequestProof />
    </ParcnetClientProvider>
  );
}

function RequestProof() {
  const { z, connectionState } = useParcnetClient();
  const [ticket, setTicket] = useState<PODData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);


  const requestTicket = useCallback(async () => {
    if (connectionState !== ClientConnectionState.CONNECTED) return;

    // Use the DevconTicketSpec to query the Devcon SEA collection
    // This will return any valid ticket with the Devcon event ID and public
    // key, as specified in lib/ticketSchema.ts
    const res = await z.pod.collection("Devcon SEA").query(DevconTicketSpec);

    if (res.length > 0) {
      setTicket(res[0]);
    } else {
      setError("No Devcon ticket found");
    }
  }, [z]);

  const verifyTicket = useCallback(async () => {
    if (!ticket) return;
    if (connectionState !== ClientConnectionState.CONNECTED) return;

    const ticketPOD = POD.load(
      ticket.entries,
      ticket.signature,
      ticket.signerPublicKey
    );

    // To prove that the ticket belongs to the user, we create a signed POD
    // with the user's public key. On the server-side, we verify that this
    // matches the "owner" entry on the ticket.
    // The _UNSAFE_ prefix allows us to request non-interactive signatures.
    const proofOfIdentity = await z.pod.signPrefixed({
      _UNSAFE_ticketId: {
        type: "string",
        value: ticket.entries.ticketId.value.toString(),
      },
    });
    const proofOfIdentityPOD = POD.load(
      proofOfIdentity.entries,
      proofOfIdentity.signature,
      proofOfIdentity.signerPublicKey
    );

    const res = await fetch("/api/verify", {
      method: "POST",
      body: JSON.stringify({
        serializedTicket: ticketPOD.toJSON(),
        serializedProofOfIdentity: proofOfIdentityPOD.toJSON(),
      }),
    });
    const data = await res.json();
    setVerified(data.verified);
  }, [ticket]);

  if (connectionState !== ClientConnectionState.CONNECTED) return null;

  return (
    <div className="flex flex-col gap-4 my-8">
      <div>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
          onClick={requestTicket}
        >
          Request Proof
        </button>
      </div>
      {error && <div className="text-red-500">{error}</div>}
      {ticket && (
        <>
          <div className="bg-gray-800 p-4 rounded-lg mt-4 overflow-x-auto">
            <div>Ticket found</div>
            <div>
              Name:{" "}
              {ticket.entries.attendeeName.value}
            </div>
            <div>
              Email:{" "}
              {ticket.entries.attendeeEmail.value}
            </div>
            <div className="mt-4">
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
                onClick={verifyTicket}
              >
                Verify Ticket
              </button>
            </div>
          </div>
          {verified !== null && verified && (
            <div className="text-green-500">Ticket verified</div>
          )}
          {verified !== null && !verified && (
            <div className="text-red-500">Ticket not verified</div>
          )}
        </>
      )}
    </div>
  );
}
