import { pgTable, text, serial, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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

// Manual audit sessions
export const auditSessions = pgTable("audit_sessions", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull().references(() => scanResults.id),
  auditorName: text("auditor_name").notNull(),
  status: text("status").notNull().default('in_progress'), // 'in_progress', 'completed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
});

// WCAG criteria evaluation
export const wcagCriteria = pgTable("wcag_criteria", {
  id: serial("id").primaryKey(),
  auditSessionId: integer("audit_session_id").notNull().references(() => auditSessions.id),
  criteriaId: text("criteria_id").notNull(), // e.g., "1.1.1", "1.2.1"
  title: text("title").notNull(),
  level: text("level").notNull(), // 'A', 'AA', 'AAA'
  status: text("status").notNull().default('not_evaluated'), // 'passed', 'failed', 'not_applicable', 'not_evaluated'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Screenshots for criteria
export const criteriaScreenshots = pgTable("criteria_screenshots", {
  id: serial("id").primaryKey(),
  criteriaId: integer("criteria_id").notNull().references(() => wcagCriteria.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Relations
export const scanResultsRelations = relations(scanResults, ({ many }) => ({
  auditSessions: many(auditSessions),
}));

export const auditSessionsRelations = relations(auditSessions, ({ one, many }) => ({
  scanResult: one(scanResults, {
    fields: [auditSessions.scanId],
    references: [scanResults.id],
  }),
  wcagCriteria: many(wcagCriteria),
}));

export const wcagCriteriaRelations = relations(wcagCriteria, ({ one, many }) => ({
  auditSession: one(auditSessions, {
    fields: [wcagCriteria.auditSessionId],
    references: [auditSessions.id],
  }),
  screenshots: many(criteriaScreenshots),
}));

export const criteriaScreenshotsRelations = relations(criteriaScreenshots, ({ one }) => ({
  criteria: one(wcagCriteria, {
    fields: [criteriaScreenshots.criteriaId],
    references: [wcagCriteria.id],
  }),
}));

// Insert schemas
export const insertScanResultSchema = createInsertSchema(scanResults).omit({
  id: true,
  scanDate: true,
}).extend({
  wcagLevel: z.enum(['A', 'AA', 'AAA']).optional(),
});

export const insertAuditSessionSchema = createInsertSchema(auditSessions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertWcagCriteriaSchema = createInsertSchema(wcagCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCriteriaScreenshotSchema = createInsertSchema(criteriaScreenshots).omit({
  id: true,
  uploadedAt: true,
});

// Types
export type InsertScanResult = z.infer<typeof insertScanResultSchema>;
export type ScanResult = typeof scanResults.$inferSelect;
export type InsertAuditSession = z.infer<typeof insertAuditSessionSchema>;
export type AuditSession = typeof auditSessions.$inferSelect;
export type InsertWcagCriteria = z.infer<typeof insertWcagCriteriaSchema>;
export type WcagCriteria = typeof wcagCriteria.$inferSelect;
export type InsertCriteriaScreenshot = z.infer<typeof insertCriteriaScreenshotSchema>;
export type CriteriaScreenshot = typeof criteriaScreenshots.$inferSelect;

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
  format: 'pdf' | 'json' | 'csv' | 'docx';
}

// Manual audit interfaces
export interface AuditSessionRequest {
  scanId: number;
  auditorName: string;
}

export interface CriteriaEvaluationRequest {
  criteriaId: string;
  status: 'passed' | 'failed' | 'not_applicable' | 'not_evaluated';
  notes?: string;
}

export interface ScreenshotUploadRequest {
  criteriaId: number;
  file: File;
  description?: string;
}

// Predefined WCAG criteria structure
export interface WcagCriteriaDefinition {
  id: string;
  title: string;
  level: 'A' | 'AA' | 'AAA';
  description: string;
  section: string;
}
