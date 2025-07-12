import { client, papiClient } from "./client.js";

const eventId = 0;
const ticketId = await client.tickets.calls.issue(eventId);

console.log(`Issue ticket ${ticketId} on event ${eventId}`);

papiClient.destroy();