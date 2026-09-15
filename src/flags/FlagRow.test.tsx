import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlagRow } from "./FlagsPage";
import type { AdmissionFlag } from "./flags";

const holder = "a".repeat(64);
const receiver = "b".repeat(64);

const transferred: AdmissionFlag = {
  reportId: "00000000-0000-4000-8000-000000000001",
  gate: "North door",
  operator: "00000000-0000-4000-8000-000000000002",
  ticket: "c".repeat(64),
  passId: "d".repeat(32),
  refusal: { errorCode: "ERR-InvalidPass" },
  cause: "transfer-before-recording",
  presentedAt: 1_789_430_000_000,
  deviceClock: 1_789_430_001_000,
  receivedAt: 1_789_430_001_200,
  clockDrift: -200,
  recordingDeadline: null,
  otherReports: [],
  transfers: [{ from: holder, to: receiver, recordedAt: 1_789_430_000_500, sequence: 42 }],
};

describe("a flagged admission", () => {
  // The end-to-end check of this cause against a real transfer is T-040-14's
  // (e2e/flags.spec.ts); this test checks the row's rendering in isolation.
  it("REQ-OP-3 shows a transfer between verdict and recording, with the transfer that explains it", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <FlagRow flag={transferred} operatorName="Noor" />
        </tbody>
      </table>,
    );
    expect(html).toContain('data-cause="transfer-before-recording"');
    expect(html).toContain(
      "Ticket transferred between the gate&#x27;s verdict and the ledger&#x27;s recording",
    );
    expect(html).toContain("no longer held the ticket");
    expect(html).toContain("ERR-InvalidPass");
    expect(html).toContain("Noor");
    expect(html).toContain(
      `Transferred from <code>${holder.slice(0, 12)}…</code> to <code>${receiver.slice(0, 12)}…</code>`,
    );
    expect(html).toContain("−0.2 s");
  });
});
