import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scanResults = pgTable("scan_results", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  violations: jsonb("violations").notNull().default([]),
  passedTests: integer("passed_tests").notNull().default(0),
  elementsScanned: integer("elements_scanned").notNull().default(0),
  complianceScore: integer("compliance_score").notNull().default(0),
  wcagLevel: text("wcag_level").notNull().default('AA'), // 'A', 'AA', 'AAA'
  scanDate: timestamp("scan_date").defaultNow().notNull(),
  errorMessage: text("error_message"),
});

export const insertScanResultSchema = createInsertSchema(scanResults).omit({
  id: true,
  scanDate: true,
}).extend({
  wcagLevel: z.enum(['A', 'AA', 'AAA']).optional(),
});

export type InsertScanResult = z.infer<typeof insertScanResultSchema>;
export type ScanResult = typeof scanResults.$inferSelect;

// Violation interface for type safety
export interface Violation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: ViolationNode[];
}

export interface ViolationNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

export interface ScanRequest {
  url: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface ScanResponse {
  scanId: number;
  status: string;
  message: string;
}

export interface ReportExportRequest {
  scanId: number;
  format: 'pdf' | 'json' | 'docx';
}
