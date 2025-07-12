import { client, papiClient } from "./client.js";

import QRCode from "qrcode";

const eventId = 0;
const ticketId = 0n;

const attendanceRequest = await client.tickets.query.attendanceRequest(eventId, ticketId);

QRCode.toString(Buffer.from(attendanceRequest).toString("base64"), { type: "terminal" }, (_, qr) => {
  console.log(qr);
  papiClient.destroy();
})
