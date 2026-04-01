/*
 * LLD Document Generator
 * Calls the Supabase Edge Function which uses the Anthropic API
 * to generate a professional LLD document from questionnaire answers.
 */

import { supabase } from "./supabase.js";

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

/**
 * Generate an LLD document using the Anthropic API via Supabase Edge Function.
 * @param {{ projectName: string, clientName: string, answers: string[], projectId?: string }} params
 * @returns {Promise<{ lldContent: string, model?: string, usage?: object }>}
 */
export async function generateLLD({ projectName, clientName, answers, projectId }) {
  const { data, error } = await supabase.functions.invoke("generate-lld", {
    body: { projectName, clientName, answers, projectId },
  });

  if (error) {
    console.error("LLD generation error:", error);
    throw new Error(error.message || "Failed to generate LLD document");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * Build a basic LLD summary from answers (fallback if API is unavailable).
 * Returns a structured markdown string.
 */
export function buildFallbackLLD({ projectName, clientName, answers }) {
  const date = new Date().toISOString().split("T")[0];
  const sections = [];

  sections.push(`# Low-Level Design Document: ${projectName}`);
  sections.push(`**Client:** ${clientName}`);
  sections.push(`**Prepared by:** Elecbits Engineering Team`);
  sections.push(`**Date:** ${date}`);
  sections.push(`**Status:** Draft — Pending Review`);
  sections.push(`\n---\n`);

  // Group answers by category
  const categories = [
    { title: "Product Overview", range: [0, 5] },
    { title: "Functions & Features", range: [5, 10] },
    { title: "Connectivity", range: [10, 14] },
    { title: "Power Management", range: [14, 18] },
    { title: "Software & Cloud", range: [18, 21] },
    { title: "Physical Design", range: [21, 24] },
    { title: "Certifications & Compliance", range: [24, 26] },
    { title: "Cost & Timeline", range: [26, 30] },
  ];

  for (const cat of categories) {
    sections.push(`\n## ${cat.title}\n`);
    for (let i = cat.range[0]; i < cat.range[1]; i++) {
      const answer = answers[i] || "Not specified";
      sections.push(`**${LLD_QUESTION_LABELS[i]}:** ${answer}`);
    }
  }

  sections.push(`\n---\n`);
  sections.push(`> *This is a preliminary LLD based on client responses. A detailed engineering review is required to finalize component selections, architecture decisions, and compliance strategy.*`);

  return sections.join("\n");
}
