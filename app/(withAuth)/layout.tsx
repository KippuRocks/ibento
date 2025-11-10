"use client";

import { ReactNode, useEffect, useState } from "react";
import { TickettoProvider } from "../providers/TickettoProvider";
import { getPapiSigner, PapiSigner } from "../providers/PapiSigner";

export default function WithAuth({ children }: { children: ReactNode }) {
  const [papiSigner, setPapiSigner] = useState<PapiSigner>();
  useEffect(() => {
    getPapiSigner("").then(setPapiSigner);
  }, []);
  if (!papiSigner) return null;
  return <TickettoProvider account={papiSigner}>{children}</TickettoProvider>;
}
