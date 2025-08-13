// Basic types and interfaces for the accessibility scanner
export interface ScanResult {
  id: string;
  url: string;
  status: 'pending' | 'completed' | 'failed';
  violations: Violation[];
  passedTests: number;
  elementsScanned: number;
  complianceScore: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
  scanDate: string;
  errorMessage?: string;
}

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
  scanId: string;
  status: string;
  message: string;
}

export interface ReportExportRequest {
  scanId: string;
  format: 'pdf' | 'json' | 'csv' | 'docx';
}

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
