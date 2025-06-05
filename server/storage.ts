import { 
  scanResults, auditSessions, wcagCriteria, criteriaScreenshots,
  type ScanResult, type InsertScanResult,
  type AuditSession, type InsertAuditSession,
  type WcagCriteria, type InsertWcagCriteria,
  type CriteriaScreenshot, type InsertCriteriaScreenshot
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  createScanResult(scanResult: InsertScanResult): Promise<ScanResult>;
  getScanResult(id: number): Promise<ScanResult | undefined>;
  updateScanResult(id: number, updates: Partial<InsertScanResult>): Promise<ScanResult | undefined>;
  getAllScanResults(): Promise<ScanResult[]>;
  
  // Manual audit methods
  createAuditSession(auditSession: InsertAuditSession): Promise<AuditSession>;
  getAuditSession(id: number): Promise<AuditSession | undefined>;
  getAuditSessionByScanId(scanId: number): Promise<AuditSession | undefined>;
  updateAuditSession(id: number, updates: Partial<InsertAuditSession>): Promise<AuditSession | undefined>;
  
  // WCAG criteria methods
  createWcagCriteria(criteria: InsertWcagCriteria): Promise<WcagCriteria>;
  getWcagCriteriaBySession(auditSessionId: number): Promise<WcagCriteria[]>;
  updateWcagCriteria(id: number, updates: Partial<InsertWcagCriteria>): Promise<WcagCriteria | undefined>;
  
  // Screenshot methods
  createScreenshot(screenshot: InsertCriteriaScreenshot): Promise<CriteriaScreenshot>;
  getScreenshotsByCriteria(criteriaId: number): Promise<CriteriaScreenshot[]>;
  deleteScreenshot(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private scanResults: Map<number, ScanResult>;
  private currentId: number;

  constructor() {
    this.scanResults = new Map();
    this.currentId = 1;
  }

  async createScanResult(insertScanResult: InsertScanResult): Promise<ScanResult> {
    const id = this.currentId++;
    const scanResult: ScanResult = {
      ...insertScanResult,
      id,
      violations: insertScanResult.violations || [],
      passedTests: insertScanResult.passedTests || 0,
      elementsScanned: insertScanResult.elementsScanned || 0,
      complianceScore: insertScanResult.complianceScore || 0,
      wcagLevel: insertScanResult.wcagLevel || 'AA',
      scanDate: new Date(),
      errorMessage: insertScanResult.errorMessage || null,
    };
    this.scanResults.set(id, scanResult);
    return scanResult;
  }

  async getScanResult(id: number): Promise<ScanResult | undefined> {
    return this.scanResults.get(id);
  }

  async updateScanResult(id: number, updates: Partial<InsertScanResult>): Promise<ScanResult | undefined> {
    const existingScan = this.scanResults.get(id);
    if (!existingScan) {
      return undefined;
    }

    const updatedScan: ScanResult = {
      ...existingScan,
      ...updates,
    };
    this.scanResults.set(id, updatedScan);
    return updatedScan;
  }

  async getAllScanResults(): Promise<ScanResult[]> {
    return Array.from(this.scanResults.values());
  }
}

export const storage = new MemStorage();
