import { type AccountId } from "@ticketto/types";
import { PolkadotSigner } from "polkadot-api";

import { mnemonicToMiniSecret, ss58Address } from "@polkadot-labs/hdkd-helpers";
import { getPolkadotSigner } from "polkadot-api/signer";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";

const SEED_PHRASE = process.env.NEXT_PUBLIC_SEED_PHRASE;

export type PapiSigner = {
  address: AccountId;
  signer: PolkadotSigner;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getPapiSigner(_username: string) {
  const derive = sr25519CreateDerive(mnemonicToMiniSecret(SEED_PHRASE!));
  const { publicKey, sign } = derive("");

  return {
    address: ss58Address(publicKey),
    signer: getPolkadotSigner(publicKey, "Sr25519", sign),
  } as PapiSigner;
}
