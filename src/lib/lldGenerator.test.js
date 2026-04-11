import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
vi.mock("./supabase.js", () => ({
  supabase: { functions: { invoke: mockInvoke } },
}));

const SAMPLE_ANSWERS = [
  "Smart soil moisture sensor for precision agriculture",
  "Agritech / IoT",
  "Farmers waste water by over-irrigating crops",
  "Small-to-medium farm operators in India",
  "Rachio, Netafim wireless soil sensors",
  "Real-time soil moisture, temperature, EC; LoRaWAN uplink; solar charging",
  "Capacitive moisture sensor, DS18B20 temperature, EC probe",
  "LED status, buzzer alert",
  "OLED 0.96\" display + 2 buttons",
  "Edge ML for anomaly detection",
  "LoRaWAN long range",
  "LoRaWAN 868MHz",
  "USB-C for config",
  "AWS IoT Core via LoRaWAN gateway",
  "Solar + Li-ion 18650",
  "2 years",
  "<50uA sleep, <80mA active",
  "Deep sleep between readings",
  "React Native companion app",
  "Yes via LoRaWAN FUOTA",
  "Yes — soil trends, yield predictions",
  "80 x 60 x 25 mm",
  "Outdoor IP67, -20 to +60C",
  "UV-resistant ABS",
  "CE, FCC, IC",
  "RoHS compliant",
  "$45 BOM target",
  "10000 units",
  "Q3 2026",
  "Must survive monsoon flooding",
];

describe("generateLLD", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("calls the edge function with the expected payload and returns its data", async () => {
    mockInvoke.mockResolvedValue({
      data: { lldContent: "# LLD\n## Section 1\nFoo", model: "claude-sonnet-4", usage: { input_tokens: 1234, output_tokens: 5678 } },
      error: null,
    });

    const { generateLLD } = await import("./lldGenerator.js");
    const result = await generateLLD({
      projectName: "AgriSense Pro",
      clientName: "GreenFields Ltd",
      answers: SAMPLE_ANSWERS,
      projectId: "Eb-25-04-001",
    });

    // Verify the call shape
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("generate-lld", {
      body: {
        projectName: "AgriSense Pro",
        clientName: "GreenFields Ltd",
        answers: SAMPLE_ANSWERS,
        projectId: "Eb-25-04-001",
      },
    });

    // Verify the response is passed through
    expect(result.lldContent).toContain("# LLD");
    expect(result.model).toBe("claude-sonnet-4");
    expect(result.usage.input_tokens).toBe(1234);
  });

  it("throws when supabase invoke returns an error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "Edge function unreachable" } });

    const { generateLLD } = await import("./lldGenerator.js");
    await expect(
      generateLLD({ projectName: "X", clientName: "Y", answers: SAMPLE_ANSWERS })
    ).rejects.toThrow("Edge function unreachable");
  });

  it("throws when the edge function returns data.error in the body", async () => {
    mockInvoke.mockResolvedValue({
      data: { error: "ANTHROPIC_API_KEY not configured" },
      error: null,
    });

    const { generateLLD } = await import("./lldGenerator.js");
    await expect(
      generateLLD({ projectName: "X", clientName: "Y", answers: SAMPLE_ANSWERS })
    ).rejects.toThrow("ANTHROPIC_API_KEY not configured");
  });

  it("supports a partial-answers payload (Generate Now button scenario)", async () => {
    mockInvoke.mockResolvedValue({ data: { lldContent: "# Partial LLD" }, error: null });

    // Simulate user clicking "Generate now" after answering only the first 5 questions
    const partial = Array(30).fill("");
    SAMPLE_ANSWERS.slice(0, 5).forEach((a, i) => { partial[i] = a; });

    const { generateLLD } = await import("./lldGenerator.js");
    await generateLLD({ projectName: "Quick", clientName: "Test", answers: partial });

    const sentBody = mockInvoke.mock.calls[0][1].body;
    expect(sentBody.answers).toHaveLength(30);
    expect(sentBody.answers[0]).toBe(SAMPLE_ANSWERS[0]);
    expect(sentBody.answers[29]).toBe(""); // empty — edge function will replace with "Not specified"
  });
});

describe("buildFallbackLLD", () => {
  it("produces a structured markdown document with all 30 answers grouped into 8 sections", async () => {
    const { buildFallbackLLD } = await import("./lldGenerator.js");
    const md = buildFallbackLLD({
      projectName: "AgriSense Pro",
      clientName: "GreenFields Ltd",
      answers: SAMPLE_ANSWERS,
    });

    // Header
    expect(md).toContain("# Low-Level Design Document: AgriSense Pro");
    expect(md).toContain("**Client:** GreenFields Ltd");
    expect(md).toContain("**Status:** Draft — Pending Review");

    // All 8 section headings
    [
      "Product Overview",
      "Functions & Features",
      "Connectivity",
      "Power Management",
      "Software & Cloud",
      "Physical Design",
      "Certifications & Compliance",
      "Cost & Timeline",
    ].forEach((title) => expect(md).toContain(`## ${title}`));

    // Spot check a few question labels and answers made it in
    expect(md).toContain("**Product Description:** Smart soil moisture sensor for precision agriculture");
    expect(md).toContain("**Wireless Protocols Required:** LoRaWAN 868MHz");
    expect(md).toContain("**Target Unit Cost (BOM):** $45 BOM target");
    expect(md).toContain("**Hard Deadline / Launch Date:** Q3 2026");
  });

  it("falls back to 'Not specified' for empty answers (Generate Now scenario)", async () => {
    const { buildFallbackLLD } = await import("./lldGenerator.js");
    const partial = Array(30).fill("");
    partial[0] = "Only answered the first one";

    const md = buildFallbackLLD({
      projectName: "Half-Empty",
      clientName: "TestCo",
      answers: partial,
    });

    expect(md).toContain("**Product Description:** Only answered the first one");
    // Q2..Q30 should all be "Not specified"
    const notSpecifiedCount = (md.match(/Not specified/g) || []).length;
    expect(notSpecifiedCount).toBe(29);
  });
});
