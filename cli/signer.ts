import {
  DEV_PHRASE,
  mnemonicToMiniSecret,
  ss58Address,
} from "@polkadot-labs/hdkd-helpers";
import { PolkadotSigner, SS58String } from "polkadot-api";

import { getPolkadotSigner } from "polkadot-api/signer";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";

const derive = sr25519CreateDerive(mnemonicToMiniSecret(DEV_PHRASE));

const DEV_ACCOUNTS = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eve",
  "Ferdie",
] as const;
type DevAccounts = (typeof DEV_ACCOUNTS)[number];

export type DevKeyring = Record<DevAccounts, DevSigner>;
export type DevSigner = { signer: PolkadotSigner; address: SS58String };

export const keyring = DEV_ACCOUNTS.reduce<DevKeyring>((keyring, name) => {
  const { publicKey, sign } = derive(`//${name}`);
  keyring[name] = {
    signer: getPolkadotSigner(publicKey, "Sr25519", sign),
    address: ss58Address(publicKey),
  };
  return keyring;
}, {} as unknown as DevKeyring);

export async function signerFromTime(time = Date.now()) {
  const { publicKey, sign } = derive(`//${time}`);
  return {
    signer: getPolkadotSigner(publicKey, "Sr25519", sign),
    address: ss58Address(publicKey),
  };
}
