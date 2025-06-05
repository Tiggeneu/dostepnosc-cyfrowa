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

export class DatabaseStorage implements IStorage {
  async createScanResult(insertScanResult: InsertScanResult): Promise<ScanResult> {
    const [scanResult] = await db
      .insert(scanResults)
      .values(insertScanResult)
      .returning();
    return scanResult;
  }

  async getScanResult(id: number): Promise<ScanResult | undefined> {
    const [scanResult] = await db.select().from(scanResults).where(eq(scanResults.id, id));
    return scanResult || undefined;
  }

  async updateScanResult(id: number, updates: Partial<InsertScanResult>): Promise<ScanResult | undefined> {
    const [scanResult] = await db
      .update(scanResults)
      .set(updates)
      .where(eq(scanResults.id, id))
      .returning();
    return scanResult || undefined;
  }

  async getAllScanResults(): Promise<ScanResult[]> {
    return await db.select().from(scanResults);
  }

  // Manual audit methods
  async createAuditSession(auditSession: InsertAuditSession): Promise<AuditSession> {
    const [session] = await db
      .insert(auditSessions)
      .values(auditSession)
      .returning();
    return session;
  }

  async getAuditSession(id: number): Promise<AuditSession | undefined> {
    const [session] = await db.select().from(auditSessions).where(eq(auditSessions.id, id));
    return session || undefined;
  }

  async getAuditSessionByScanId(scanId: number): Promise<AuditSession | undefined> {
    const [session] = await db.select().from(auditSessions).where(eq(auditSessions.scanId, scanId));
    return session || undefined;
  }

  async updateAuditSession(id: number, updates: Partial<InsertAuditSession>): Promise<AuditSession | undefined> {
    const [session] = await db
      .update(auditSessions)
      .set(updates)
      .where(eq(auditSessions.id, id))
      .returning();
    return session || undefined;
  }

  // WCAG criteria methods
  async createWcagCriteria(criteria: InsertWcagCriteria): Promise<WcagCriteria> {
    const [criteriaResult] = await db
      .insert(wcagCriteria)
      .values(criteria)
      .returning();
    return criteriaResult;
  }

  async getWcagCriteriaBySession(auditSessionId: number): Promise<WcagCriteria[]> {
    return await db.select().from(wcagCriteria).where(eq(wcagCriteria.auditSessionId, auditSessionId));
  }

  async updateWcagCriteria(id: number, updates: Partial<InsertWcagCriteria>): Promise<WcagCriteria | undefined> {
    const [criteriaResult] = await db
      .update(wcagCriteria)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(wcagCriteria.id, id))
      .returning();
    return criteriaResult || undefined;
  }

  // Screenshot methods
  async createScreenshot(screenshot: InsertCriteriaScreenshot): Promise<CriteriaScreenshot> {
    const [screenshotResult] = await db
      .insert(criteriaScreenshots)
      .values(screenshot)
      .returning();
    return screenshotResult;
  }

  async getScreenshotsByCriteria(criteriaId: number): Promise<CriteriaScreenshot[]> {
    return await db.select().from(criteriaScreenshots).where(eq(criteriaScreenshots.criteriaId, criteriaId));
  }

  async deleteScreenshot(id: number): Promise<boolean> {
    const result = await db.delete(criteriaScreenshots).where(eq(criteriaScreenshots.id, id));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
