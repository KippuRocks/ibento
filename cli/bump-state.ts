import { client, papiClient } from "./client.js";

const eventId = 0;
await client.events.calls.bumpState(eventId);

console.log(`bumped state for event ${eventId}`);

papiClient.destroy();