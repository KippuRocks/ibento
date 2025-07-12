import { client, papiClient } from "./client.js";

import { AttendancePolicyType } from "@ticketto/types";

const NOW = BigInt(Date.now());
const DAY = 86_400_000n;

const eventId = await client.events.calls.createEvent({
  capacity: 100n,
  class: {
    attendancePolicy: {
      type: AttendancePolicyType.Single,
    },
    ticketprice: {
      amount: 1_000000n,
      asset: {
        code: 'dUSD',
        decimals: 6,
        id: 50_000_002,
      }
    },
    ticketRestrictions: {
      cannotResale: false,
      cannotTransfer: false,
    }
  },
  name: "First Ibento",
  dates: [[NOW - DAY, NOW + DAY]],
});

console.log(`Created event ${eventId}`);

papiClient.destroy();