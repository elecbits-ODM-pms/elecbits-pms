import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LLD_QUESTION_LABELS = [
  "Product Description",
  "Product Category",
  "Problem Statement",
  "Target User",
  "Reference Products",
  "Key Features / Functions",
  "Sensors / Input Devices",
  "Outputs / Actuators",
  "User Interface",
  "Special Processing (AI/ML, real-time)",
  "Wireless Connectivity Description",
  "Wireless Protocols Required",
  "Wired Interfaces",
  "Cloud / Backend Connectivity",
  "Power Source",
  "Expected Battery Life",
  "Power Consumption Constraints",
  "Sleep / Power-saving Modes",
  "Companion App",
  "OTA Update Capability",
  "Data Logging / Analytics",
  "Size Constraints (L x W x H)",
  "Operating Environment",
  "Enclosure Material",
  "Required Certifications",
  "Regulatory / Compliance Notes",
  "Target Unit Cost (BOM)",
  "Production Volume (Year 1)",
  "Hard Deadline / Launch Date",
  "Special Requests / Risks / Constraints",
];

function buildPrompt(
  projectName: string,
  clientName: string,
  answers: string[],
  projectId: string
): string {
  const qaPairs = LLD_QUESTION_LABELS.map((label, i) => {
    const answer = answers[i] || "Not specified";
    return `${i + 1}. **${label}**: ${answer}`;
  }).join("\n");

  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `You are a senior hardware engineering architect at Elecbits (AzooX Technologies Private Limited), a leading end-to-end electronics design and engineering firm based in India, specialising in hardware design, firmware development, and PCB manufacturing for industrial, IoT, and consumer electronics products.

A client has provided the following information about their product through our intake questionnaire:

**Project**: ${projectName}
**Client**: ${clientName}
**Project ID**: ${projectId || "TBD"}

## Client Responses:
${qaPairs}

---

Generate a comprehensive **Low-Level Design (LLD) Document** in clean markdown. The document must be professional, extremely detailed, and immediately actionable for the Elecbits engineering team. Follow the EXACT structure below — this is the Elecbits standard LLD template used for real client deliveries.

# DOCUMENT STRUCTURE — FOLLOW THIS EXACTLY:

---

## Document Header

| ${projectId || "Eb-XX-XX-XXX"} | Confidential

## Electronics Design & Engineering

**${projectId || "Eb-XX-XX-XXX"}**
**LOW-LEVEL DESIGN DOCUMENT**
**${projectName}**

**Prepared for:** ${clientName}
**Prepared by:** Elecbits Engineering Team
**Document ID:** ${projectId || "Eb-XX-XX-XXX"}
**Date:** ${today}
**Version:** 1.0 | **Revision:** 0

---

## Revision History

Create a table with columns: Rev. | Date | Description | Author
Include v1.0 (this document) plus placeholder rows for v1.1 (Schematic complete), v1.2 (PCB layout, Gerber release), v1.3 (Firmware bring-up, BSP integration), v1.4 (Prototype validation, certification pre-scan), v2.0 (Final release package).

---

## Company Overview

Include one paragraph: "Elecbits is an end-to-end electronics design and engineering firm based in India, specialising in hardware design, firmware development, and PCB manufacturing for industrial, IoT, and consumer electronics products." Then a second paragraph summarizing the technical plan for THIS specific project.

---

## Section 1 — Requirements Gathered

Create a DETAILED table with columns: Section | Details | Remarks
Cover ALL these sections as rows:
- **Product Overview** — summarize the product from client answers
- **Operating System** — recommend OS based on the SoC choice and product requirements
- **Display & Touch** (if applicable) — display specs, touch type
- **Connectivity** — list ALL communication interfaces (Ethernet, serial, wireless, USB, etc.)
- **Power System** — input voltage, regulators, total consumption estimate
- **Enclosure** — material, IP rating, dimensions, mounting
- **Memory** — RAM, Flash/eMMC, NV storage, RTC
- **Programming Software** — firmware/HMI framework recommendations
- **Environmental** — operating and storage temp ranges, humidity
- **Certifications Target** — list all required certifications with standards
- **Industries** — target industries/applications

---

## Section 2 — Feature ↔ Estimated BOM

This is the MOST IMPORTANT section. Create a VERY DETAILED table with columns: Feature | Detailed Requirement | Primary Component | Alternative | Datasheet / Reference

Include AT MINIMUM 25-35 rows covering:
- **Core SoC/MCU** — with exact part number (e.g., ESP32-S3-WROOM-1-N16R8, STM32F407VGT6, TI AM3358BZCZA100, nRF52840)
- **SoM Module Option** (if applicable) — ready-made module to accelerate development
- **RAM** (if external) — DDR3/PSRAM with part number
- **Flash/eMMC** — for OS/app storage
- **NV Backup Memory** — FRAM/EEPROM for settings
- **RTC** — with battery backup
- **Display** (if applicable) — LCD/OLED with exact part number
- **Touch Controller** (if applicable)
- **Backlight Driver** (if applicable)
- **Each sensor/input device** — separate row per sensor
- **Each output/actuator** — separate row per actuator
- **Input Power Protection** — reverse polarity + surge TVS
- **Primary Voltage Regulator** — buck/boost converter
- **Secondary LDO/regulators** — for 3.3V, 1.8V, etc.
- **PMIC** (if SoC requires it)
- **Wireless Module** (if applicable) — Wi-Fi, BLE, LoRa, Cellular, etc.
- **Ethernet PHY + RJ45** (if applicable)
- **RS-232 / RS-485 / CAN Transceiver** (if applicable)
- **USB Controller/PHY + Connectors** (if applicable)
- **ESD Protection** arrays
- **Ferrite Beads** for EMC
- **Crystal Oscillator**
- **Status LEDs** — bicolour/RGB
- **Buttons** — reset, mode, user
- **Connectors** — power, debug, I/O
- **PCB Material** — FR4 stackup
- **Enclosure parts** — front, rear, gaskets, fasteners

For EVERY component: provide the exact manufacturer part number, an alternative part, and a datasheet reference URL or domain.

---

## Section 3 — Hardware & Software Block Diagram

### 3.1 Hardware Block Diagram (Functional Blocks)
Describe textually — cover EVERY sub-system:
- **Power Sub-system** — input protection → regulator chain → all voltage rails
- **Memory Sub-system** — RAM + Flash + NV storage + RTC
- **Display Sub-system** (if applicable) — controller → display → backlight driver
- **Touch Sub-system** (if applicable) — touch panel → controller IC → SoC
- **Connectivity** — each interface: Ethernet (MAC→PHY→RJ45), Serial (UART→transceiver→connector), USB, Wireless
- **Sensor/Input Sub-system** — each sensor with interface type
- **Output/Actuator Sub-system** — each actuator with driver
- **User Interface** — LEDs, buttons, buzzer
- **Debug** — UART console, JTAG header

### 3.2 Software Architecture
Use bullet points:
- **Bootloader** — type, boot source, fallback
- **OS** — kernel version, BSP, device tree
- **Application Framework** — HMI/app framework
- **Protocol Stack** — communication protocols
- **OTA** — update mechanism (if applicable)
- **Secure Boot** (if applicable)

---

## Section 4 — Cost Estimation

### 4.1 Engineering Cost
Table with columns: Engineering Work Package | Cost / Pricing (INR)
Include: Hardware Schematic + PCB Design, Firmware Development, Enclosure/ID, Prototype Assembly, Compliance, Total Engineering Cost, Prototype Unit Cost, Enclosure Tooling (if applicable).

### 4.2 Estimated Product Unit Cost (BOM + Manufacturing)
Table with columns: Volume | BOM Cost (INR) | Estimated Price | Notes
Include rows for: 5 units (proto), 50, 200, 1000, 5000, 10000+
Provide REALISTIC INR cost estimates based on Indian market pricing.

---

## Section 5 — Selected SoC / Module

### 5.1 Primary Recommendation
Table with ALL key parameters: CPU Core, Cache/SRAM, RAM Interface, GPU/Accelerator, Display Controller, Connectivity (Ethernet, USB, UART, I2C, SPI, CAN), ADC, Timers/PWM, Temperature Grade, Package, OS Support, Longevity, Price.

### 5.2 SoC Comparison Matrix
Table comparing the recommended SoC against 3 alternatives with ALL the same parameters. Mark one as RECOMMENDED.

---

## Section 6 — Interface Specification

Table with columns: Interface | Connector / Standard | SoC Pin Mapping | Notes
Cover ALL external interfaces. Include baud rates, impedance, ESD protection notes.

---

## Section 7 — Firmware Framework

Table with columns: Layer | Component / Tool | Notes
Cover: Bootloader, OS Kernel, Display Driver, Touch Driver, Communication Drivers, USB Stack, RTC Driver, Application Framework, Protocol Libraries, OTA Update, Secure Boot, Build System, Development Tools.

### 7.1 Application Software Options
Bullet points with 2-3 options for the HMI/application layer with trade-offs.

---

## Section 8 — Process & Key Roles

### 8.1 Team Composition
Table: Role | Count | Responsibility
Include: PM, Sr. HW Engineer, Assoc. HW Engineer, HW Engineer (Backup), Sr. FW Engineer, Assoc. FW Engineer, Industrial/Enclosure Designer, QA/Compliance Engineer.

### 8.2 Hardware Designing Process
Table: Task / Description | Stakeholder | Phase
Cover the FULL process from requirements analysis through to final file package. Include 20+ tasks across phases: Hardware Design, Schematic, PCB Design, File Generation, Enclosure.

---

## Section 9 — Certification Requirements

Table: Certification | Standard / Body | Estimated Cost (INR) | Timeline
Include ALL relevant certs from client requirements. Use realistic Indian market costs (INR).

### 9.1 Certification Strategy
Bullet points on how to reduce certification risk and cost (module-level certs, pre-compliance scans, etc.).

---

## Section 10 — Technical Considerations

### 10.1 Power & Power Integrity
Detailed bullet points on: surge immunity, power sequencing, brown-out margin, thermal management for regulators.

### 10.2 PCB Design Considerations
Detailed bullet points on: stackup (layer count, plane assignments), impedance-controlled traces, differential pairs, keep-outs, test pads.

### 10.3 Display & Touch (if applicable)
FPC cable, backlight dimming, touch calibration, IP rating validation.

### 10.4 EMC / ESD
ESD protection strategy, ferrite beads, chassis grounding, shielding.

### 10.5 Firmware Robustness
Dual rootfs, hardware watchdog, serial watchdog, factory reset mechanism.

### 10.6 Security
Secure boot, flash encryption, OTA signing, network security.

---

## Section 11 — Timeline

Table: Milestone | Target Day | Deliverable | Owner
Split into clear phases:
- **PHASE 1: DESIGN TO PROTOTYPE (Day 1–45)** — requirements lock, schematic, PCB layout, Gerbers, BSP bring-up, driver development (in parallel), enclosure CAD (in parallel), board bring-up, functional prototype, integrated prototype
- **PHASE 2: CERTIFICATION (Day 46–75)** — compliance rework, pre-compliance scan, documentation, pilot manufacturing, lab submission, field evaluation

Mark parallel tasks explicitly with [PARALLEL].

---

## Section 12 — Future Design Considerations

5-7 bullet points on potential future enhancements (new connectivity, display variants, expansion I/O, alternative OS/UI, etc.).

---

## Section 13 — Contingencies

### 13.1 Cost & Timeline Variation Factors
Bullet points on: requirements changes, component lead times, exchange rates, certification delays, tooling.

### 13.2 Risk Mitigation
Bullet points on: dual-sourcing, pre-certified modules, pre-compliance testing, reference unit comparison.

---

## Assumptions

Table: Assumption | Details
Include 6-8 key assumptions about: reference unit, specifications source, application software scope, cloud scope, certification body, tooling approval, protocol/API documentation.

---

## Contact & Document Footer

**Document prepared by:** Elecbits Engineering Team
**Document ID:** ${projectId || "Eb-XX-XX-XXX"} | **Version:** 1.0 | **Date:** ${today}
© ${new Date().getFullYear()} AzooX Technologies Private Limited. Confidential — prepared exclusively for ${clientName}.

---

## CRITICAL QUALITY REQUIREMENTS:
1. **REAL PART NUMBERS** — Every component must have a real, existing manufacturer part number (e.g., TI AM3358BZCZA100, Micron MT41K128M16JT-125, NXP PCF85063A). Never use placeholder or made-up part numbers.
2. **ALTERNATIVES** — Every critical component must list an alternative part from a different manufacturer.
3. **REALISTIC COSTS** — All costs in INR, based on real Indian market pricing. BOM costs should be realistic for the product category.
4. **TABLES EVERYWHERE** — Use markdown tables extensively. The BOM section should be the largest section.
5. **MINIMUM 5000 WORDS** — This must be a thorough, production-ready document.
6. **ACTIONABLE** — An engineer should be able to start the schematic directly from this document.
7. **DATASHEET REFERENCES** — Include manufacturer website domains for component lookup.
8. If information is missing, make reasonable engineering assumptions and CLEARLY mark them as "[ASSUMPTION]".`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { projectName, clientName, answers, projectId } = await req.json();

    if (!projectName || !answers || !Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: projectName, answers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(projectName, clientName || "Unknown", answers, projectId || "");

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16384,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return new Response(
        JSON.stringify({ error: "LLD generation failed", details: err }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const lldContent = result.content?.[0]?.text || "";

    return new Response(
      JSON.stringify({ lldContent, model: result.model, usage: result.usage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
