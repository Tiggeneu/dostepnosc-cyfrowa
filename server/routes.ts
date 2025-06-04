import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScanResultSchema, type ScanRequest, type ScanResponse, type ReportExportRequest, type Violation } from "@shared/schema";
import { z } from "zod";
import puppeteer from "puppeteer";
import { AxePuppeteer } from "@axe-core/puppeteer";

const scanRequestSchema = z.object({
  url: z.string().url("Please provide a valid URL"),
});

const reportExportRequestSchema = z.object({
  scanId: z.number(),
  format: z.enum(['pdf', 'json']),
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Start accessibility scan
  app.post("/api/scan", async (req, res) => {
    try {
      const { url } = scanRequestSchema.parse(req.body);
      
      // Create initial scan record
      const scanResult = await storage.createScanResult({
        url,
        status: 'pending',
        violations: [],
        passedTests: 0,
        elementsScanned: 0,
        complianceScore: 0,
      });

      // Start scan in background
      performAccessibilityScan(scanResult.id, url);

      const response: ScanResponse = {
        scanId: scanResult.id,
        status: 'pending',
        message: 'Scan initiated successfully'
      };

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to initiate scan" });
    }
  });

  // Get scan result
  app.get("/api/scan/:id", async (req, res) => {
    try {
      const scanId = parseInt(req.params.id);
      const scanResult = await storage.getScanResult(scanId);
      
      if (!scanResult) {
        return res.status(404).json({ message: "Scan not found" });
      }

      res.json(scanResult);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve scan result" });
    }
  });

  // Export report
  app.post("/api/export", async (req, res) => {
    try {
      const { scanId, format } = reportExportRequestSchema.parse(req.body);
      
      const scanResult = await storage.getScanResult(scanId);
      if (!scanResult) {
        return res.status(404).json({ message: "Scan not found" });
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="accessibility-report-${scanId}.json"`);
        res.json(scanResult);
      } else if (format === 'pdf') {
        // For PDF generation, we'll return the raw data and let the frontend handle it
        // In a production app, you might use a library like puppeteer-pdf or jsPDF
        res.json({
          message: "PDF export functionality would be implemented here",
          data: scanResult
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to export report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background scan function
async function performAccessibilityScan(scanId: number, url: string) {
  let browser;
  try {
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent results
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to the URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Run axe-core accessibility tests
    const results = await new AxePuppeteer(page).analyze();

    // Process violations
    const violations: Violation[] = results.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact as 'minor' | 'moderate' | 'serious' | 'critical',
      tags: violation.tags,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map(node => ({
        html: node.html,
        target: Array.isArray(node.target) ? node.target : [String(node.target)],
        failureSummary: node.failureSummary
      }))
    }));

    // Calculate metrics
    const totalViolations = violations.length;
    const passedTests = results.passes.length;
    const elementsScanned = results.violations.reduce((acc, v) => acc + v.nodes.length, 0) + 
                           results.passes.reduce((acc, p) => acc + p.nodes.length, 0);
    const complianceScore = Math.round((passedTests / (passedTests + totalViolations)) * 100);

    // Update scan result
    await storage.updateScanResult(scanId, {
      status: 'completed',
      violations: violations as any,
      passedTests,
      elementsScanned,
      complianceScore,
    });

  } catch (error) {
    console.error('Scan failed:', error);
    
    // Update scan result with error
    await storage.updateScanResult(scanId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
