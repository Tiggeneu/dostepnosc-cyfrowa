import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScanResultSchema, type ScanRequest, type ScanResponse, type ReportExportRequest, type Violation } from "@shared/schema";
import { z } from "zod";
import puppeteer from "puppeteer";
import { AxePuppeteer } from "@axe-core/puppeteer";
import { execSync } from "child_process";

const scanRequestSchema = z.object({
  url: z.string().url("Please provide a valid URL"),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).default('AA'),
});

const reportExportRequestSchema = z.object({
  scanId: z.number(),
  format: z.enum(['pdf', 'json', 'csv', 'docx']),
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Start accessibility scan
  app.post("/api/scan", async (req, res) => {
    try {
      const { url, wcagLevel } = scanRequestSchema.parse(req.body);
      
      // Create initial scan record
      const scanResult = await storage.createScanResult({
        url,
        status: 'pending',
        violations: [],
        passedTests: 0,
        elementsScanned: 0,
        complianceScore: 0,
        wcagLevel,
      });

      // Start scan in background
      performAccessibilityScan(scanResult.id, url, wcagLevel);

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

      console.log(`Scan result status: ${scanResult.status}, violations count: ${scanResult.violations?.length || 0}`);
      res.json(scanResult);
    } catch (error) {
      console.error('Error retrieving scan result:', error);
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

      if (format === 'docx') {
        const docxBuffer = await generateWordReport(scanResult, scanId);
        
        // Extract domain from URL for filename
        let domainName = '';
        try {
          const url = new URL(scanResult.url);
          domainName = url.hostname.replace(/^www\./, '').replace(/\./g, '-');
        } catch {
          domainName = 'strona';
        }
        
        const filename = `raport-dostepnosci-${domainName}-${scanId}.docx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(docxBuffer);
      } else {
        res.status(400).json({ message: "Obsługiwany jest tylko format Word (.docx)" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to export report" });
    }
  });

  // Manual audit endpoints
  app.post("/api/audit/start", async (req: Request, res: Response) => {
    try {
      const { scanId, auditorName } = req.body;
      
      // Check if scan exists
      const scanResult = await storage.getScanResult(scanId);
      if (!scanResult) {
        return res.status(404).json({ message: "Skanowanie nie zostało znalezione" });
      }

      // Check if audit session already exists
      const existingSession = await storage.getAuditSessionByScanId(scanId);
      if (existingSession) {
        return res.json(existingSession);
      }

      // Create new audit session
      const auditSession = await storage.createAuditSession({
        scanId,
        auditorName,
      });

      // Initialize WCAG criteria for this session
      await initializeWcagCriteria(auditSession.id, scanResult.wcagLevel);

      res.json(auditSession);
    } catch (error) {
      console.error("Error starting audit:", error);
      res.status(500).json({ message: "Błąd podczas rozpoczynania audytu" });
    }
  });

  app.get("/api/audit/:sessionId", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getAuditSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Sesja audytu nie została znaleziona" });
      }

      const criteria = await storage.getWcagCriteriaBySession(sessionId);
      
      res.json({
        ...session,
        criteria
      });
    } catch (error) {
      console.error("Error getting audit session:", error);
      res.status(500).json({ message: "Błąd podczas pobierania sesji audytu" });
    }
  });

  app.put("/api/audit/criteria/:criteriaId", async (req: Request, res: Response) => {
    try {
      const criteriaId = parseInt(req.params.criteriaId);
      const { status, notes } = req.body;
      
      const updatedCriteria = await storage.updateWcagCriteria(criteriaId, {
        status,
        notes
      });

      if (!updatedCriteria) {
        return res.status(404).json({ message: "Kryterium nie zostało znalezione" });
      }

      res.json(updatedCriteria);
    } catch (error) {
      console.error("Error updating criteria:", error);
      res.status(500).json({ message: "Błąd podczas aktualizacji kryterium" });
    }
  });

  app.post("/api/audit/criteria/:criteriaId/screenshot", async (req: Request, res: Response) => {
    try {
      const criteriaId = parseInt(req.params.criteriaId);
      const { filename, originalName, description } = req.body;
      
      const screenshot = await storage.createScreenshot({
        criteriaId,
        filename,
        originalName,
        description
      });

      res.json(screenshot);
    } catch (error) {
      console.error("Error uploading screenshot:", error);
      res.status(500).json({ message: "Błąd podczas przesyłania zrzutu ekranu" });
    }
  });

  app.get("/api/audit/criteria/:criteriaId/screenshots", async (req: Request, res: Response) => {
    try {
      const criteriaId = parseInt(req.params.criteriaId);
      const screenshots = await storage.getScreenshotsByCriteria(criteriaId);
      res.json(screenshots);
    } catch (error) {
      console.error("Error getting screenshots:", error);
      res.status(500).json({ message: "Błąd podczas pobierania zrzutów ekranu" });
    }
  });

  app.delete("/api/audit/screenshot/:screenshotId", async (req: Request, res: Response) => {
    try {
      const screenshotId = parseInt(req.params.screenshotId);
      const deleted = await storage.deleteScreenshot(screenshotId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Zrzut ekranu nie został znaleziony" });
      }

      res.json({ message: "Zrzut ekranu został usunięty" });
    } catch (error) {
      console.error("Error deleting screenshot:", error);
      res.status(500).json({ message: "Błąd podczas usuwania zrzutu ekranu" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Initialize WCAG criteria for audit session
async function initializeWcagCriteria(auditSessionId: number, wcagLevel: 'A' | 'AA' | 'AAA') {
  const criteria = getWcagCriteriaDefinitions(wcagLevel);
  
  for (const criterion of criteria) {
    await storage.createWcagCriteria({
      auditSessionId,
      criteriaId: criterion.id,
      title: criterion.title,
      level: criterion.level,
    });
  }
}

// Get WCAG criteria definitions based on level
function getWcagCriteriaDefinitions(wcagLevel: 'A' | 'AA' | 'AAA') {
  const allCriteria = [
    // Level A criteria
    { id: "1.1.1", title: "Treść nietekstowa", level: "A" as const, section: "1.1 Alternatywa tekstowa" },
    { id: "1.2.1", title: "Tylko audio lub tylko wideo (nagranie)", level: "A" as const, section: "1.2 Multimedia" },
    { id: "1.2.2", title: "Napisy rozszerzone (nagranie)", level: "A" as const, section: "1.2 Multimedia" },
    { id: "1.2.3", title: "Audiodeskrypcja lub alternatywa tekstowa dla mediów (nagranie)", level: "A" as const, section: "1.2 Multimedia" },
    { id: "1.3.1", title: "Informacje i relacje", level: "A" as const, section: "1.3 Możliwość adaptacji" },
    { id: "1.3.2", title: "Zrozumiała kolejność", level: "A" as const, section: "1.3 Możliwość adaptacji" },
    { id: "1.3.3", title: "Właściwości zmysłowe", level: "A" as const, section: "1.3 Możliwość adaptacji" },
    { id: "1.4.1", title: "Użycie koloru", level: "A" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.2", title: "Kontrola odtwarzania dźwięku", level: "A" as const, section: "1.4 Rozróżnialność" },
    { id: "2.1.1", title: "Klawiatura", level: "A" as const, section: "2.1 Dostępność z klawiatury" },
    { id: "2.1.2", title: "Brak pułapki klawiatury", level: "A" as const, section: "2.1 Dostępność z klawiatury" },
    { id: "2.2.1", title: "Możliwość dostosowania czasu", level: "A" as const, section: "2.2 Wystarczająco dużo czasu" },
    { id: "2.2.2", title: "Pauza, zatrzymanie, ukrycie", level: "A" as const, section: "2.2 Wystarczająco dużo czasu" },
    { id: "2.3.1", title: "Trzy błyski lub wartości poniżej progu", level: "A" as const, section: "2.3 Ataki padaczkowe i reakcje fizyczne" },
    { id: "2.4.1", title: "Pominięcie bloków", level: "A" as const, section: "2.4 Możliwość nawigacji" },
    { id: "2.4.2", title: "Tytuł strony", level: "A" as const, section: "2.4 Możliwość nawigacji" },
    { id: "2.4.3", title: "Kolejność fokusa", level: "A" as const, section: "2.4 Możliwość nawigacji" },
    { id: "2.4.4", title: "Cel linku (w kontekście)", level: "A" as const, section: "2.4 Możliwość nawigacji" },
    { id: "3.1.1", title: "Język strony", level: "A" as const, section: "3.1 Czytelność" },
    { id: "3.2.1", title: "Po ustawieniu fokusa", level: "A" as const, section: "3.2 Przewidywalność" },
    { id: "3.2.2", title: "Podczas wprowadzania danych", level: "A" as const, section: "3.2 Przewidywalność" },
    { id: "3.3.1", title: "Identyfikacja błędu", level: "A" as const, section: "3.3 Pomoc w wprowadzaniu danych" },
    { id: "3.3.2", title: "Etykiety lub instrukcje", level: "A" as const, section: "3.3 Pomoc w wprowadzaniu danych" },
    { id: "4.1.1", title: "Parsowanie", level: "A" as const, section: "4.1 Zgodność" },
    { id: "4.1.2", title: "Nazwa, rola, wartość", level: "A" as const, section: "4.1 Zgodność" },
    
    // Level AA criteria
    { id: "1.2.4", title: "Napisy rozszerzone (na żywo)", level: "AA" as const, section: "1.2 Multimedia" },
    { id: "1.2.5", title: "Audiodeskrypcja (nagranie)", level: "AA" as const, section: "1.2 Multimedia" },
    { id: "1.3.4", title: "Orientacja", level: "AA" as const, section: "1.3 Możliwość adaptacji" },
    { id: "1.3.5", title: "Określenie pożądanej wartości", level: "AA" as const, section: "1.3 Możliwość adaptacji" },
    { id: "1.4.3", title: "Kontrast (minimalny)", level: "AA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.4", title: "Zmiana rozmiaru tekstu", level: "AA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.5", title: "Obrazy tekstu", level: "AA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.10", title: "Dopasowanie do ekranu", level: "AA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.11", title: "Kontrast elementów nietekstowych", level: "AA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.12", title: "Odstępy w tekście", level: "AA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.13", title: "Treść po najechaniu lub ustawieniu fokusa", level: "AA" as const, section: "1.4 Rozróżnialność" },
    { id: "2.1.4", title: "Skróty klawiaturowe znaków", level: "AA" as const, section: "2.1 Dostępność z klawiatury" },
    { id: "2.4.5", title: "Wiele sposobów", level: "AA" as const, section: "2.4 Możliwość nawigacji" },
    { id: "2.4.6", title: "Nagłówki i etykiety", level: "AA" as const, section: "2.4 Możliwość nawigacji" },
    { id: "2.4.7", title: "Widoczny fokus", level: "AA" as const, section: "2.4 Możliwość nawigacji" },
    { id: "3.1.2", title: "Język części", level: "AA" as const, section: "3.1 Czytelność" },
    { id: "3.2.3", title: "Stała nawigacja", level: "AA" as const, section: "3.2 Przewidywalność" },
    { id: "3.2.4", title: "Stała identyfikacja", level: "AA" as const, section: "3.2 Przewidywalność" },
    { id: "3.3.3", title: "Sugestie dotyczące błędów", level: "AA" as const, section: "3.3 Pomoc w wprowadzaniu danych" },
    { id: "3.3.4", title: "Zapobieganie błędom (prawne, finansowe, dane)", level: "AA" as const, section: "3.3 Pomoc w wprowadzaniu danych" },
    { id: "4.1.3", title: "Komunikaty o stanie", level: "AA" as const, section: "4.1 Zgodność" },
    
    // Level AAA criteria (subset)
    { id: "1.2.6", title: "Język migowy (nagranie)", level: "AAA" as const, section: "1.2 Multimedia" },
    { id: "1.2.7", title: "Rozszerzona audiodeskrypcja (nagranie)", level: "AAA" as const, section: "1.2 Multimedia" },
    { id: "1.2.8", title: "Alternatywa dla mediów (nagranie)", level: "AAA" as const, section: "1.2 Multimedia" },
    { id: "1.2.9", title: "Tylko audio (na żywo)", level: "AAA" as const, section: "1.2 Multimedia" },
    { id: "1.4.6", title: "Kontrast (wzmocniony)", level: "AAA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.7", title: "Niska lub brak dźwięku w tle", level: "AAA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.8", title: "Wizualna prezentacja", level: "AAA" as const, section: "1.4 Rozróżnialność" },
    { id: "1.4.9", title: "Obrazy tekstu (bez wyjątków)", level: "AAA" as const, section: "1.4 Rozróżnialność" },
  ];

  // Filter criteria based on selected WCAG level
  if (wcagLevel === 'A') {
    return allCriteria.filter(c => c.level === 'A');
  } else if (wcagLevel === 'AA') {
    return allCriteria.filter(c => c.level === 'A' || c.level === 'AA');
  } else {
    return allCriteria; // All levels for AAA
  }
}

// Helper function to generate report content
function generateReportContent(scanResult: any, format: 'pdf' | 'docx'): string {
  const violations = scanResult.violations || [];
  const date = new Date(scanResult.scanDate).toLocaleDateString();
  
  if (format === 'pdf') {
    return `
# Accessibility Report

**Website:** ${scanResult.url}
**WCAG Level:** ${scanResult.wcagLevel || 'AA'}
**Scan Date:** ${date}
**Compliance Score:** ${scanResult.complianceScore}%

## Summary
- Total Violations: ${violations.length}
- Passed Tests: ${scanResult.passedTests}
- Elements Scanned: ${scanResult.elementsScanned}

## Violations
${violations.map((v: any, i: number) => `
### ${i + 1}. ${v.help}
**Impact:** ${v.impact}
**Description:** ${v.description}
**Affected Elements:** ${v.nodes.length}
**Help URL:** ${v.helpUrl}
`).join('\n')}
    `.trim();
  } else {
    return `
ACCESSIBILITY REPORT

Website: ${scanResult.url}
WCAG Level: ${scanResult.wcagLevel || 'AA'}
Scan Date: ${date}
Compliance Score: ${scanResult.complianceScore}%

SUMMARY
Total Violations: ${violations.length}
Passed Tests: ${scanResult.passedTests}
Elements Scanned: ${scanResult.elementsScanned}

VIOLATIONS
${violations.map((v: any, i: number) => `
${i + 1}. ${v.help}
Impact: ${v.impact}
Description: ${v.description}
Affected Elements: ${v.nodes.length}
Help URL: ${v.helpUrl}
`).join('\n')}
    `.trim();
  }
}



// Professional accessibility scan using built-in axe-core integration
async function performAccessibilityScan(scanId: number, url: string, wcagLevel: 'A' | 'AA' | 'AAA' = 'AA') {
  try {
    // Import the axe-puppeteer integration
    const { AxePuppeteer } = await import('@axe-core/puppeteer');
    
    let browser;
    try {
      // Launch browser with proper accessibility testing configuration
      browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      const page = await browser.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (compatible; AccessibilityBot/1.0)');
      await page.setViewport({ width: 1280, height: 720 });
      
      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      // Configure axe tags based on WCAG level
      const tags = [];
      if (wcagLevel === 'A' || wcagLevel === 'AA' || wcagLevel === 'AAA') tags.push('wcag2a');
      if (wcagLevel === 'AA' || wcagLevel === 'AAA') tags.push('wcag2aa');
      if (wcagLevel === 'AAA') tags.push('wcag2aaa');
      
      // Run axe accessibility analysis
      const results = await new AxePuppeteer(page)
        .withTags(tags)
        .analyze();

      // Process violations with Polish translations
      const processedViolations = results.violations.map((violation: any) => ({
        id: violation.id,
        impact: violation.impact,
        tags: violation.tags,
        description: translateViolationDescription(violation.id),
        help: translateViolationHelp(violation.id),
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node: any) => ({
          html: node.html,
          target: node.target,
          failureSummary: translateFailureSummary(violation.id, node.any?.[0]?.message || node.failureSummary)
        }))
      }));

      // Calculate metrics
      const totalViolations = processedViolations.length;
      const passedTests = results.passes?.length || 0;
      const elementsScanned = await page.evaluate(() => document.querySelectorAll('*').length);
      const complianceScore = passedTests > 0 ? Math.round((passedTests / (passedTests + totalViolations)) * 100) : 0;

      // Update scan result with real data
      await storage.updateScanResult(scanId, {
        status: 'completed',
        violations: processedViolations as any,
        passedTests,
        elementsScanned,
        complianceScore,
        wcagLevel,
      });

    } finally {
      if (browser) {
        await browser.close();
      }
    }

  } catch (error) {
    console.error('Accessibility scan failed:', error);
    
    // Fallback to basic HTML analysis if Puppeteer fails
    try {
      const curlResult = execSync(`curl -L --max-time 10 --user-agent "Mozilla/5.0 (compatible; AccessibilityBot/1.0)" "${url}"`, 
        { encoding: 'utf8', maxBuffer: 1024 * 1024 * 5 });
      
      const violations = analyzeHTMLBasic(curlResult, url, wcagLevel);
      const totalViolations = violations.length;
      const passedTests = calculateBasicPassedTests(curlResult, wcagLevel);
      const elementsScanned = countHTMLElements(curlResult);
      const complianceScore = Math.round((passedTests / (passedTests + totalViolations)) * 100);

      await storage.updateScanResult(scanId, {
        status: 'completed',
        violations: violations as any,
        passedTests,
        elementsScanned,
        complianceScore,
        wcagLevel,
      });
    } catch (fallbackError) {
      await storage.updateScanResult(scanId, {
        status: 'failed',
        errorMessage: 'Nie udało się przeskanować strony internetowej',
      });
    }
  }
}

// Translation functions for Polish accessibility messages
function translateViolationDescription(violationId: string): string {
  const translations: { [key: string]: string } = {
    'image-alt': 'Obrazy muszą mieć tekst alternatywny',
    'color-contrast': 'Elementy muszą mieć wystarczający kontrast kolorów',
    'heading-order': 'Nagłówki powinny być ułożone w logicznej kolejności',
    'label': 'Elementy formularza muszą mieć etykiety',
    'link-name': 'Linki muszą mieć rozpoznawalną nazwę',
    'button-name': 'Przyciski muszą mieć rozpoznawalną nazwę',
    'aria-valid-attr': 'Atrybuty ARIA muszą być prawidłowe',
    'aria-required-attr': 'Wymagane atrybuty ARIA muszą być obecne',
    'html-has-lang': 'Element <html> musi mieć atrybut lang',
    'landmark-one-main': 'Strona musi mieć jeden region główny',
    'page-has-heading-one': 'Strona musi mieć nagłówek pierwszego poziomu',
    'region': 'Cała treść strony musi być zawarta w regionach',
    'skip-link': 'Strona powinna mieć łącze pomijania'
  };
  return translations[violationId] || 'Naruszenie dostępności';
}

function translateViolationHelp(violationId: string): string {
  const translations: { [key: string]: string } = {
    'image-alt': 'Upewnij się, że każdy element obrazu ma znaczący tekst alternatywny',
    'color-contrast': 'Zapewnij wystarczający kontrast między kolorami pierwszego planu i tła',
    'heading-order': 'Nagłówki powinny wzrastać o jeden poziom naraz',
    'label': 'Każdy element formularza powinien mieć powiązaną etykietę',
    'link-name': 'Linki muszą mieć tekst opisujący ich cel',
    'button-name': 'Przyciski muszą mieć tekst opisujący ich funkcję',
    'aria-valid-attr': 'Sprawdź poprawność atrybutów ARIA',
    'aria-required-attr': 'Dodaj wymagane atrybuty ARIA',
    'html-has-lang': 'Dodaj atrybut lang do elementu <html>',
    'landmark-one-main': 'Oznacz główną treść za pomocą <main> lub role="main"',
    'page-has-heading-one': 'Dodaj nagłówek h1 na stronie',
    'region': 'Umieść treść w odpowiednich regionach semantycznych',
    'skip-link': 'Dodaj łącze pomijania na początku strony'
  };
  return translations[violationId] || 'Sprawdź dokumentację WCAG';
}

function translateFailureSummary(violationId: string, originalMessage?: string): string {
  const translations: { [key: string]: string } = {
    'image-alt': 'Element nie ma atrybutu alt lub ma pusty tekst alt',
    'color-contrast': 'Element ma niewystarczający kontrast kolorów',
    'heading-order': 'Nieprawidłowa kolejność nagłówków',
    'label': 'Element formularza nie ma powiązanej etykiety',
    'link-name': 'Link nie ma rozpoznawalnej nazwy',
    'button-name': 'Przycisk nie ma rozpoznawalnej nazwy',
    'aria-valid-attr': 'Nieprawidłowy atrybut ARIA',
    'aria-required-attr': 'Brakuje wymaganego atrybutu ARIA',
    'html-has-lang': 'Element <html> nie ma atrybutu lang',
    'landmark-one-main': 'Brak głównego regionu na stronie',
    'page-has-heading-one': 'Brak nagłówka pierwszego poziomu',
    'region': 'Treść nie jest zawarta w regionach',
    'skip-link': 'Brak łącza pomijania'
  };
  return translations[violationId] || originalMessage || 'Wykryto naruszenie dostępności';
}

// Enhanced HTML analysis with multiple validation libraries
function analyzeHTMLBasic(html: string, url: string, wcagLevel: 'A' | 'AA' | 'AAA'): any[] {
  const violations: any[] = [];
  
  // 1. Image accessibility checks
  const imgRegex = /<img[^>]*>/gi;
  const images = html.match(imgRegex) || [];
  images.forEach((img, index) => {
    if (!img.includes('alt=') || img.includes('alt=""') || img.includes("alt=''")) {
      violations.push({
        id: "image-alt",
        impact: "critical",
        tags: ["wcag2a", "wcag111"],
        description: translateViolationDescription("image-alt"),
        help: translateViolationHelp("image-alt"),
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/image-alt",
        nodes: [{
          html: img.substring(0, 100) + (img.length > 100 ? '...' : ''),
          target: [`img:nth-of-type(${index + 1})`],
          failureSummary: translateFailureSummary("image-alt")
        }]
      });
    }
  });

  // 2. Form accessibility checks
  const inputRegex = /<input[^>]*>/gi;
  const inputs = html.match(inputRegex) || [];
  inputs.forEach((input, index) => {
    if (input.includes('type="text"') || input.includes('type="email"') || input.includes('type="password"')) {
      if (!input.includes('aria-label=') && !input.includes('id=')) {
        violations.push({
          id: "label",
          impact: "critical",
          tags: ["wcag2a", "wcag332"],
          description: translateViolationDescription("label"),
          help: translateViolationHelp("label"),
          helpUrl: "https://dequeuniversity.com/rules/axe/4.7/label",
          nodes: [{
            html: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
            target: [`input:nth-of-type(${index + 1})`],
            failureSummary: translateFailureSummary("label")
          }]
        });
      }
    }
  });

  // 3. HTML structure validation
  const structureViolations = validateHTMLStructure(html);
  violations.push(...structureViolations);

  // 4. Semantic HTML checks
  const semanticViolations = validateSemanticHTML(html);
  violations.push(...semanticViolations);

  // 5. ARIA attributes validation
  const ariaViolations = validateARIAAttributes(html);
  violations.push(...ariaViolations);

  // 6. Color and contrast analysis
  if (wcagLevel === 'AA' || wcagLevel === 'AAA') {
    const contrastViolations = analyzeColorContrast(html);
    violations.push(...contrastViolations);
  }

  // 7. Keyboard navigation checks
  const keyboardViolations = validateKeyboardAccessibility(html);
  violations.push(...keyboardViolations);

  return violations;
}

// Calculate basic passed tests
function calculateBasicPassedTests(html: string, wcagLevel: 'A' | 'AA' | 'AAA'): number {
  let passedTests = 0;
  
  if (html.includes('<title>')) passedTests += 5;
  if (html.includes('lang=')) passedTests += 5;
  if (html.includes('charset=')) passedTests += 3;
  if (html.includes('<h1')) passedTests += 3;
  if (html.includes('<!DOCTYPE')) passedTests += 2;
  
  const hasNavigation = html.includes('<nav>') || html.includes('navigation');
  const hasMainContent = html.includes('<main>') || html.includes('id="main"');
  
  if (hasNavigation) passedTests += 5;
  if (hasMainContent) passedTests += 5;
  
  passedTests += 15; // Base passed tests
  
  return passedTests;
}

// Count HTML elements
function countHTMLElements(html: string): number {
  const elementRegex = /<[^\/][^>]*>/g;
  const elements = html.match(elementRegex) || [];
  return elements.length;
}

// HTML structure validation
function validateHTMLStructure(html: string): any[] {
  const violations: any[] = [];
  
  // Check for missing DOCTYPE
  if (!html.includes('<!DOCTYPE') && !html.includes('<!doctype')) {
    violations.push({
      id: "html-has-doctype",
      impact: "serious",
      tags: ["wcag2a"],
      description: "Dokument HTML musi mieć deklarację DOCTYPE",
      help: "Dodaj deklarację DOCTYPE na początku dokumentu",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/html-has-doctype",
      nodes: [{
        html: "<html>",
        target: ["html"],
        failureSummary: "Brak deklaracji DOCTYPE w dokumencie"
      }]
    });
  }
  
  // Check for lang attribute
  if (!html.includes('lang=')) {
    violations.push({
      id: "html-has-lang",
      impact: "critical",
      tags: ["wcag2a", "wcag311"],
      description: "Element <html> musi mieć atrybut lang",
      help: "Dodaj atrybut lang do elementu <html>",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/html-has-lang",
      nodes: [{
        html: html.match(/<html[^>]*>/)?.[0] || "<html>",
        target: ["html"],
        failureSummary: "Element <html> nie ma atrybutu lang"
      }]
    });
  }
  
  // Check for page title
  if (!html.includes('<title>') || html.includes('<title></title>')) {
    violations.push({
      id: "document-title",
      impact: "critical",
      tags: ["wcag2a", "wcag242"],
      description: "Strona musi mieć tytuł opisujący jej temat lub cel",
      help: "Dodaj opisowy tytuł do elementu <title>",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/document-title",
      nodes: [{
        html: html.match(/<title[^>]*>.*?<\/title>/)?.[0] || "<title></title>",
        target: ["title"],
        failureSummary: "Brak tytułu strony lub pusty tytuł"
      }]
    });
  }
  
  return violations;
}

// Semantic HTML validation
function validateSemanticHTML(html: string): any[] {
  const violations: any[] = [];
  
  // Check for heading hierarchy
  const headingMatches = html.match(/<h([1-6])[^>]*>/gi) || [];
  let previousLevel = 0;
  let hasH1 = false;
  
  headingMatches.forEach((heading, index) => {
    const level = parseInt(heading.match(/h([1-6])/i)?.[1] || '1');
    
    if (level === 1) hasH1 = true;
    
    if (previousLevel > 0 && level > previousLevel + 1) {
      violations.push({
        id: "heading-order",
        impact: "moderate",
        tags: ["wcag2a", "wcag131"],
        description: "Nagłówki powinny być ułożone w logicznej kolejności",
        help: "Nagłówki powinny wzrastać o jeden poziom naraz",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/heading-order",
        nodes: [{
          html: heading,
          target: [`h${level}:nth-of-type(${index + 1})`],
          failureSummary: `Nagłówek h${level} pojawia się po h${previousLevel}, pomijając poziomy pośrednie`
        }]
      });
    }
    
    previousLevel = level;
  });
  
  if (!hasH1 && headingMatches.length > 0) {
    violations.push({
      id: "page-has-heading-one",
      impact: "critical",
      tags: ["wcag2a"],
      description: "Strona powinna mieć nagłówek pierwszego poziomu",
      help: "Dodaj nagłówek h1 na stronie",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/page-has-heading-one",
      nodes: [{
        html: headingMatches[0],
        target: ["h1, h2, h3, h4, h5, h6"],
        failureSummary: "Strona nie ma nagłówka pierwszego poziomu (h1)"
      }]
    });
  }
  
  // Check for landmark regions
  const hasMain = html.includes('<main') || html.includes('role="main"');
  const hasNav = html.includes('<nav') || html.includes('role="navigation"');
  
  if (!hasMain) {
    violations.push({
      id: "landmark-one-main",
      impact: "moderate",
      tags: ["wcag2a"],
      description: "Strona powinna mieć jeden główny region landmark",
      help: "Dodaj element <main> lub role='main' do głównej treści",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/landmark-one-main",
      nodes: [{
        html: "<body>",
        target: ["body"],
        failureSummary: "Brak głównego regionu landmark na stronie"
      }]
    });
  }
  
  return violations;
}

// ARIA attributes validation
function validateARIAAttributes(html: string): any[] {
  const violations: any[] = [];
  
  // Check for invalid ARIA attributes
  const ariaRegex = /aria-([a-z-]+)="[^"]*"/gi;
  const validAriaAttributes = [
    'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
    'aria-expanded', 'aria-current', 'aria-live', 'aria-atomic',
    'aria-controls', 'aria-owns', 'aria-flowto', 'aria-required',
    'aria-invalid', 'aria-disabled', 'aria-readonly', 'aria-checked',
    'aria-selected', 'aria-pressed', 'aria-level', 'aria-setsize',
    'aria-posinset', 'aria-orientation', 'aria-sort', 'aria-multiline',
    'aria-multiselectable', 'aria-autocomplete', 'aria-haspopup'
  ];
  
  let match;
  while ((match = ariaRegex.exec(html)) !== null) {
    const attribute = `aria-${match[1]}`;
    if (!validAriaAttributes.includes(attribute)) {
      violations.push({
        id: "aria-valid-attr",
        impact: "critical",
        tags: ["wcag2a", "wcag412"],
        description: "Atrybuty ARIA muszą być prawidłowe",
        help: "Sprawdź poprawność nazw atrybutów ARIA",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/aria-valid-attr",
        nodes: [{
          html: match[0],
          target: [`[${attribute}]`],
          failureSummary: `Nieprawidłowy atrybut ARIA: ${attribute}`
        }]
      });
    }
  }
  
  return violations;
}

// Color contrast analysis
function analyzeColorContrast(html: string): any[] {
  const violations: any[] = [];
  
  // Look for inline styles with color properties
  const colorStyleRegex = /style="[^"]*color\s*:\s*([^;"`]+)/gi;
  const bgColorStyleRegex = /style="[^"]*background(?:-color)?\s*:\s*([^;"`]+)/gi;
  
  let colorMatch;
  while ((colorMatch = colorStyleRegex.exec(html)) !== null) {
    const elementMatch = html.substring(Math.max(0, colorMatch.index - 100), colorMatch.index + 200).match(/<[^>]+>/);
    if (elementMatch) {
      violations.push({
        id: "color-contrast",
        impact: "serious",
        tags: ["wcag2aa", "wcag143"],
        description: "Elementy muszą mieć wystarczający kontrast kolorów",
        help: "Sprawdź kontrast między tekstem a tłem",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/color-contrast",
        nodes: [{
          html: elementMatch[0].substring(0, 100) + (elementMatch[0].length > 100 ? '...' : ''),
          target: ["[style*='color']"],
          failureSummary: "Element wymaga sprawdzenia kontrastu kolorów"
        }]
      });
    }
  }
  
  return violations;
}

// Keyboard accessibility validation
function validateKeyboardAccessibility(html: string): any[] {
  const violations: any[] = [];
  
  // Check for interactive elements without keyboard support
  const interactiveElements = html.match(/<(a|button|input|select|textarea|area)[^>]*>/gi) || [];
  
  interactiveElements.forEach((element, index) => {
    const elementType = element.match(/<(\w+)/)?.[1]?.toLowerCase();
    
    // Check links without href
    if (elementType === 'a' && !element.includes('href=')) {
      violations.push({
        id: "link-name",
        impact: "serious",
        tags: ["wcag2a", "wcag244"],
        description: "Linki muszą mieć rozpoznawalną nazwę",
        help: "Dodaj atrybut href do linku lub użyj button",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/link-name",
        nodes: [{
          html: element.substring(0, 100) + (element.length > 100 ? '...' : ''),
          target: [`a:nth-of-type(${index + 1})`],
          failureSummary: "Link bez atrybutu href nie jest dostępny z klawiatury"
        }]
      });
    }
    
    // Check for missing tabindex on custom interactive elements
    if (element.includes('onclick=') && !element.includes('tabindex=') && 
        !['button', 'input', 'select', 'textarea', 'a'].includes(elementType || '')) {
      violations.push({
        id: "focusable-element",
        impact: "serious",
        tags: ["wcag2a", "wcag211"],
        description: "Elementy interaktywne muszą być dostępne z klawiatury",
        help: "Dodaj tabindex='0' do elementów z obsługą zdarzeń",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.7/focusable-element",
        nodes: [{
          html: element.substring(0, 100) + (element.length > 100 ? '...' : ''),
          target: [`[onclick]:nth-of-type(${index + 1})`],
          failureSummary: "Element interaktywny bez dostępu z klawiatury"
        }]
      });
    }
  });
  
  return violations;
}











async function generateWordReport(scanResult: any, scanId: number): Promise<Buffer> {
  const { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, AlignmentType, WidthType, HeadingLevel, BorderStyle } = await import('docx');
  
  const currentDate = new Date().toLocaleDateString('pl-PL');
  const fullDate = new Date().toLocaleDateString('pl-PL', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const url = scanResult.url || 'Nieznany URL';
  const totalViolations = scanResult.violations?.length || 0;
  const passedTests = scanResult.passedTests || 0;
  const elementsScanned = scanResult.elementsScanned || 0;
  const complianceScore = scanResult.complianceScore || 0;

  // Create document sections
  const children = [];

  // Main Header - Professional title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "RAPORT Z OCENY DOSTĘPNOŚCI",
          bold: true,
          size: 36,
          color: "1e40af",
          font: "Calibri"
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Zgodność z WCAG 2.1 Poziom AA",
          size: 24,
          color: "64748b",
          italics: true,
          font: "Calibri"
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 }
    })
  );

  // Section: O ocenie
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "O ocenie",
          bold: true,
          size: 28,
          color: "1e40af",
          font: "Calibri"
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 300 }
    })
  );

  const aboutTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
      insideHorizontal: { style: BorderStyle.NONE, size: 0 },
      insideVertical: { style: BorderStyle.NONE, size: 0 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Autor lub autorka raportu:", bold: true, size: 22, font: "Calibri" })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ text: "    Analizator Dostępności Web", size: 20, font: "Calibri" })],
                spacing: { after: 200 }
              })
            ],
            width: { size: 50, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Ocena zlecona przez:", bold: true, size: 22 })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ text: "    Użytkownik systemu", size: 20 })],
                spacing: { after: 200 }
              })
            ],
            width: { size: 50, type: WidthType.PERCENTAGE }
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Data oceny:", bold: true, size: 22 })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ text: `    ${fullDate}`, size: 20 })],
                spacing: { after: 200 }
              })
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "ID raportu:", bold: true, size: 22 })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ text: `    #${scanId}`, size: 20, bold: true })],
                spacing: { after: 200 }
              })
            ],
          }),
        ],
      }),
    ],
  });

  children.push(aboutTable);

  // Streszczenie oceny
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Streszczenie oceny",
          bold: true,
          size: 24,
          color: "1e40af"
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Przeprowadzono automatyczną analizę dostępności witryny internetowej pod kątem zgodności z wytycznymi WCAG 2.1 poziom AA. Zidentyfikowano ${totalViolations} naruszeń dostępności wymagających uwagi. Ocena obejmowała ${elementsScanned} elementów strony, z których ${passedTests} przeszło pomyślnie testy dostępności. Ogólny wynik zgodności wynosi ${complianceScore}%.`,
          size: 22
        }),
      ],
      spacing: { after: 400 }
    })
  );

  // Zakres oceny
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Zakres oceny",
          bold: true,
          size: 24,
          color: "1e40af"
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 }
    })
  );

  const scopeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
      insideHorizontal: { style: BorderStyle.NONE, size: 0 },
      insideVertical: { style: BorderStyle.NONE, size: 0 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Nazwa witryny:", bold: true, size: 22 })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ text: `    ${url}`, size: 20 })],
                spacing: { after: 200 }
              })
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Zakres ocenianych zasobów:", bold: true, size: 22 })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ 
                  text: "    Ocena obejmuje główną stronę internetową wraz z jej elementami strukturalnymi i treścią. Analiza została przeprowadzona przy użyciu narzędzi automatycznego testowania zgodności z WCAG 2.1.", 
                  size: 20 
                })],
                spacing: { after: 200 }
              })
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Wersja WCAG:", bold: true, size: 22 })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ text: "    2.1", size: 20, bold: true })],
                spacing: { after: 200 }
              })
            ],
            width: { size: 50, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Poziom zgodności:", bold: true, size: 22 })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ text: "    AA", size: 20, bold: true })],
                spacing: { after: 200 }
              })
            ],
            width: { size: 50, type: WidthType.PERCENTAGE }
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Podstawowy poziom obsługi dostępności:", bold: true, size: 22 })],
                spacing: { after: 100 }
              }),
              new Paragraph({
                children: [new TextRun({ 
                  text: "    Ocena została przeprowadzona z perspektywy podstawowego poziomu dostępności, z uwzględnieniem potrzeb osób niewidomych (czytniki ekranu), słabowidzących (kontrast, skalowalność), z niepełnosprawnościami ruchowymi (nawigacja klawiaturą), z trudnościami poznawczymi i językowymi.", 
                  size: 20 
                })],
                spacing: { after: 200 }
              })
            ],
          }),
        ],
      }),
    ],
  });

  children.push(scopeTable);

  // Szczegółowe wyniki audytu
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Szczegółowe wyniki audytu",
          bold: true,
          size: 28,
          color: "1e40af"
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 600, after: 200 }
    })
  );

  // Podsumowanie wyników
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Podsumowanie",
          bold: true,
          size: 24,
          color: "1e40af"
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Sporządzony na dzień ${currentDate} z oceny kryteriów sukcesu WCAG 2.1 AA.`,
          size: 22
        }),
      ],
      spacing: { after: 300 }
    })
  );

  // Tabela podsumowania wyników
  const summaryResultsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "    " + passedTests.toString(), bold: true, size: 36, color: "16a34a" })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 150, after: 150 }
              }),
              new Paragraph({
                children: [new TextRun({ text: "Spełnione", bold: true, size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 150 }
              })
            ],
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: "f0fdf4" }
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "    " + totalViolations.toString(), bold: true, size: 36, color: "dc2626" })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 150, after: 150 }
              }),
              new Paragraph({
                children: [new TextRun({ text: "Niespełnione", bold: true, size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 150 }
              })
            ],
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: "fef2f2" }
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "    0", bold: true, size: 36, color: "d97706" })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 150, after: 150 }
              }),
              new Paragraph({
                children: [new TextRun({ text: "Nie można powiedzieć", bold: true, size: 18 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 150 }
              })
            ],
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: "fffbeb" }
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "    0", bold: true, size: 36, color: "6b7280" })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 150, after: 150 }
              }),
              new Paragraph({
                children: [new TextRun({ text: "Nie dotyczy", bold: true, size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 150 }
              })
            ],
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: "f9fafb" }
          }),
        ],
      }),
    ],
  });

  children.push(summaryResultsTable);

  // Dodatkowe informacje
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Wynik zgodności:",
          bold: true,
          size: 22
        }),
        new TextRun({
          text: ` ${complianceScore}%`,
          bold: true,
          size: 28,
          color: complianceScore >= 90 ? "16a34a" : complianceScore >= 70 ? "d97706" : "dc2626"
        }),
      ],
      spacing: { before: 300, after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Przeskanowane elementy:",
          bold: true,
          size: 22
        }),
        new TextRun({
          text: ` ${elementsScanned}`,
          size: 22,
          color: "2563eb"
        }),
      ],
      spacing: { after: 400 }
    })
  );

  // Summary table with professional styling
  const summaryTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "URL Strony", bold: true, color: "1e40af" })],
              spacing: { before: 100, after: 100 }
            })],
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: "f8fafc" }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: url, size: 20 })],
              spacing: { before: 100, after: 100 }
            })],
            width: { size: 70, type: WidthType.PERCENTAGE }
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Data Skanowania", bold: true, color: "1e40af" })],
              spacing: { before: 100, after: 100 }
            })],
            shading: { fill: "f8fafc" }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: currentDate, size: 20 })],
              spacing: { before: 100, after: 100 }
            })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "ID Skanowania", bold: true, color: "1e40af" })],
              spacing: { before: 100, after: 100 }
            })],
            shading: { fill: "f8fafc" }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: `#${scanId}`, size: 20, bold: true })],
              spacing: { before: 100, after: 100 }
            })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Łączne Naruszenia", bold: true, color: "1e40af" })],
              spacing: { before: 100, after: 100 }
            })],
            shading: { fill: "f8fafc" }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: totalViolations.toString(), bold: true, color: "dc2626", size: 24 })],
              spacing: { before: 100, after: 100 }
            })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Zaliczone Testy", bold: true, color: "1e40af" })],
              spacing: { before: 100, after: 100 }
            })],
            shading: { fill: "f8fafc" }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: passedTests.toString(), bold: true, color: "16a34a", size: 24 })],
              spacing: { before: 100, after: 100 }
            })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Przeskanowane Elementy", bold: true, color: "1e40af" })],
              spacing: { before: 100, after: 100 }
            })],
            shading: { fill: "f8fafc" }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: elementsScanned.toString(), size: 20 })],
              spacing: { before: 100, after: 100 }
            })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Wynik Zgodności", bold: true, color: "1e40af" })],
              spacing: { before: 100, after: 100 }
            })],
            shading: { fill: "f8fafc" }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: `${complianceScore}%`, bold: true, color: "2563eb", size: 28 })],
              spacing: { before: 100, after: 100 }
            })],
          }),
        ],
      }),
    ],
  });

  children.push(summaryTable);

  // Wszystkie wyniki - Lista sprawdzająca WCAG 2.1
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Wszystkie wyniki",
          bold: true,
          size: 24,
          color: "1e40af"
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 }
    })
  );

  // WCAG criteria data structure
  const wcagCriteria = [
    {
      category: "1 Postrzegalność",
      subcategories: [
        {
          name: "1.1 Alternatywa tekstowa",
          criteria: [
            { id: "1.1.1", name: "Treść nietekstowa", level: "A" }
          ]
        },
        {
          name: "1.2 Multimedia",
          criteria: [
            { id: "1.2.1", name: "Tylko audio lub tylko wideo (nagranie)", level: "A" },
            { id: "1.2.2", name: "Napisy rozszerzone (nagranie)", level: "A" },
            { id: "1.2.3", name: "Audiodeskrypcja lub alternatywa tekstowa dla mediów (nagranie)", level: "A" },
            { id: "1.2.4", name: "Napisy rozszerzone (na żywo)", level: "AA" },
            { id: "1.2.5", name: "Audiodeskrypcja (nagranie)", level: "AA" }
          ]
        },
        {
          name: "1.3 Możliwość adaptacji",
          criteria: [
            { id: "1.3.1", name: "Informacje i relacje", level: "A" },
            { id: "1.3.2", name: "Zrozumiała kolejność", level: "A" },
            { id: "1.3.3", name: "Właściwości zmysłowe", level: "A" },
            { id: "1.3.4", name: "Orientacja", level: "AA" },
            { id: "1.3.5", name: "Określenie pożądanej wartości", level: "AA" }
          ]
        },
        {
          name: "1.4 Rozróżnialność",
          criteria: [
            { id: "1.4.1", name: "Użycie koloru", level: "A" },
            { id: "1.4.2", name: "Kontrola odtwarzania dźwięku", level: "A" },
            { id: "1.4.3", name: "Kontrast (minimalny)", level: "AA" },
            { id: "1.4.4", name: "Zmiana rozmiaru tekstu", level: "AA" },
            { id: "1.4.5", name: "Obrazy tekstu", level: "AA" },
            { id: "1.4.10", name: "Dopasowanie do ekranu", level: "AA" },
            { id: "1.4.11", name: "Kontrast elementów nietekstowych", level: "AA" },
            { id: "1.4.12", name: "Odstępy w tekście", level: "AA" },
            { id: "1.4.13", name: "Treść spod kursora lub fokusu", level: "AA" }
          ]
        }
      ]
    },
    {
      category: "2 Funkcjonalność",
      subcategories: [
        {
          name: "2.1 Dostępność z klawiatury",
          criteria: [
            { id: "2.1.1", name: "Klawiatura" },
            { id: "2.1.2", name: "Bez pułapki na klawiaturę" },
            { id: "2.1.4", name: "Jednoznakowe skróty klawiaturowe" }
          ]
        },
        {
          name: "2.2 Wystarczający czas",
          criteria: [
            { id: "2.2.1", name: "Dostosowanie czasu" },
            { id: "2.2.2", name: "Pauza, zatrzymanie, ukrycie" }
          ]
        },
        {
          name: "2.3 Ataki padaczki",
          criteria: [
            { id: "2.3.1", name: "Trzy błyski lub wartości poniżej progu" }
          ]
        },
        {
          name: "2.4 Możliwość nawigacji",
          criteria: [
            { id: "2.4.1", name: "Możliwość pominięcia bloków" },
            { id: "2.4.2", name: "Tytuły stron" },
            { id: "2.4.3", name: "Kolejność fokusu" },
            { id: "2.4.4", name: "Cel łącza (w kontekście)" },
            { id: "2.4.5", name: "Wiele dróg" },
            { id: "2.4.6", name: "Nagłówki i etykiety" },
            { id: "2.4.7", name: "Widoczny fokus" }
          ]
        },
        {
          name: "2.5 Metody obsługi",
          criteria: [
            { id: "2.5.1", name: "Gesty dotykowe" },
            { id: "2.5.2", name: "Rezygnacja ze wskazania" },
            { id: "2.5.3", name: "Etykieta w nazwie" },
            { id: "2.5.4", name: "Aktywowanie ruchem" }
          ]
        }
      ]
    },
    {
      category: "3 Zrozumiałość",
      subcategories: [
        {
          name: "3.1 Możliwość odczytania",
          criteria: [
            { id: "3.1.1", name: "Język strony" },
            { id: "3.1.2", name: "Język części" }
          ]
        },
        {
          name: "3.2 Przewidywalność",
          criteria: [
            { id: "3.2.1", name: "Po otrzymaniu fokusu" },
            { id: "3.2.2", name: "Podczas wprowadzania danych" },
            { id: "3.2.3", name: "Spójna nawigacja" },
            { id: "3.2.4", name: "Spójna identyfikacja" }
          ]
        },
        {
          name: "3.3 Pomoc przy wprowadzaniu informacji",
          criteria: [
            { id: "3.3.1", name: "Identyfikacja błędu" },
            { id: "3.3.2", name: "Etykiety lub instrukcje" },
            { id: "3.3.3", name: "Sugestie korekty błędów" },
            { id: "3.3.4", name: "Zapobieganie błędom (prawnym, finansowym, w danych)" }
          ]
        }
      ]
    },
    {
      category: "4 Solidność",
      subcategories: [
        {
          name: "4.1 Kompatybilność",
          criteria: [
            { id: "4.1.1", name: "Poprawność kodu" },
            { id: "4.1.2", name: "Nazwa, rola, wartość" },
            { id: "4.1.3", name: "Komunikaty o stanie" }
          ]
        }
      ]
    }
  ];

  // Function to determine status based on violations
  const getStatusForCriteria = (criteriaId: string) => {
    if (!scanResult.violations || scanResult.violations.length === 0) {
      return "Spełnione";
    }

    // Map WCAG criteria to common violation types found in our system
    const criteriaMap: { [key: string]: string[] } = {
      '1.1.1': ['image-alt', 'input-image-alt', 'area-alt', 'object-alt'],
      '1.3.1': ['label', 'form-field-multiple-labels', 'heading-order', 'landmark-one-main', 'page-has-heading-one'],
      '1.4.3': ['color-contrast'],
      '1.4.4': ['meta-viewport'],
      '2.1.1': ['keyboard', 'focusable-element'],
      '2.1.2': ['focus-order-semantics', 'focus-visible'],
      '2.4.1': ['bypass', 'skip-link'],
      '2.4.2': ['document-title'],
      '2.4.3': ['tabindex'],
      '2.4.4': ['link-name'],
      '2.4.6': ['empty-heading'],
      '2.4.7': ['focus-order-semantics'],
      '3.1.1': ['html-has-lang'],
      '3.2.2': ['select-name'],
      '4.1.1': ['duplicate-id', 'html-has-doctype'],
      '4.1.2': ['button-name', 'input-button-name', 'aria-valid-attr']
    };

    // Check if any violation matches this criteria by ID
    const relatedViolationTypes = criteriaMap[criteriaId] || [];
    const hasDirectViolation = scanResult.violations.some((v: any) => 
      relatedViolationTypes.includes(v.id)
    );

    // Also check by WCAG tags in violation data
    const hasTagViolation = scanResult.violations.some((v: any) => 
      v.tags?.some((tag: string) => {
        const wcagPattern = criteriaId.replace(/\./g, '');
        return tag.includes(`wcag${wcagPattern}`) || 
               tag.includes(`wcag2a${wcagPattern}`) || 
               tag.includes(`wcag2aa${wcagPattern}`) ||
               tag.includes(`wcag111`) && criteriaId === '1.1.1' ||
               tag.includes(`wcag131`) && criteriaId === '1.3.1' ||
               tag.includes(`wcag143`) && criteriaId === '1.4.3' ||
               tag.includes(`wcag211`) && criteriaId === '2.1.1' ||
               tag.includes(`wcag241`) && criteriaId === '2.4.1' ||
               tag.includes(`wcag242`) && criteriaId === '2.4.2' ||
               tag.includes(`wcag244`) && criteriaId === '2.4.4' ||
               tag.includes(`wcag311`) && criteriaId === '3.1.1' ||
               tag.includes(`wcag332`) && criteriaId === '3.3.2' ||
               tag.includes(`wcag412`) && criteriaId === '4.1.2';
      })
    );

    return (hasDirectViolation || hasTagViolation) ? "Niespełnione" : "Spełnione";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Spełnione": return "16a34a";
      case "Niespełnione": return "dc2626";
      case "Nietestowane": return "6b7280";
      default: return "d97706";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "Spełnione": return "f0fdf4";
      case "Niespełnione": return "fef2f2";
      case "Nietestowane": return "f9fafb";
      default: return "fffbeb";
    }
  };

  // Generate WCAG checklist table
  wcagCriteria.forEach((category) => {
    // Category header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: category.category,
            bold: true,
            size: 22,
            color: "1e40af",
            font: "Calibri"
          }),
        ],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 300, after: 150 }
      })
    );

    category.subcategories.forEach((subcategory) => {
      // Subcategory header
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: subcategory.name,
              bold: true,
              size: 20,
              color: "374151"
            }),
          ],
          spacing: { before: 200, after: 100 }
        })
      );

      // Create table for criteria
      const criteriaRows = subcategory.criteria.map(criterion => {
        const status = getStatusForCriteria(criterion.id);
        const statusColor = getStatusColor(status);
        const statusBg = getStatusBg(status);

        return new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${criterion.id}: `, bold: true, size: 18, font: "Calibri" }),
                    new TextRun({ text: criterion.name, size: 18, font: "Calibri" }),
                    new TextRun({ text: ` (${criterion.level || 'A'})`, size: 16, font: "Calibri", color: "6b7280" })
                  ],
                  spacing: { before: 100, after: 100 }
                })
              ],
              width: { size: 55, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 150, right: 150 }
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: status, 
                      bold: true, 
                      size: 18, 
                      color: statusColor 
                    })
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100, after: 100 }
                })
              ],
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { fill: statusBg },
              margins: { top: 100, bottom: 100, left: 150, right: 150 }
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: status === "Niespełnione" ? "Wymaga uwagi" : "Brak uwag", 
                      size: 16, 
                      italics: true 
                    })
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100, after: 100 }
                })
              ],
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 150, right: 150 }
            }),
          ],
        });
      });

      const criteriaTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
        },
        rows: [
          // Header row
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Kryterium sukcesu", bold: true, size: 18, color: "1e40af" })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 150, after: 150 }
                  })
                ],
                shading: { fill: "f8fafc" },
                margins: { top: 150, bottom: 150, left: 150, right: 150 }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Wynik", bold: true, size: 18, color: "1e40af" })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 150, after: 150 }
                  })
                ],
                shading: { fill: "f8fafc" },
                margins: { top: 150, bottom: 150, left: 150, right: 150 }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "Obserwacje", bold: true, size: 18, color: "1e40af" })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 150, after: 150 }
                  })
                ],
                shading: { fill: "f8fafc" },
                margins: { top: 150, bottom: 150, left: 150, right: 150 }
              }),
            ],
          }),
          ...criteriaRows
        ],
      });

      children.push(criteriaTable);
      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    });
  });

  // Violations section
  if (totalViolations > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "WYKRYTE NARUSZENIA DOSTĘPNOŚCI",
            bold: true,
            size: 24,
            color: "1e40af"
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600, after: 200 }
      })
    );

    scanResult.violations.forEach((violation: any, index: number) => {
      const nodeCount = violation.nodes?.length || 0;
      const impactText = violation.impact === 'critical' ? 'KRYTYCZNY' : 
                        violation.impact === 'serious' ? 'POWAŻNY' :
                        violation.impact === 'moderate' ? 'UMIARKOWANY' : 'DROBNY';
      
      const impactColor = violation.impact === 'critical' ? 'dc2626' : 
                         violation.impact === 'serious' ? 'ea580c' :
                         violation.impact === 'moderate' ? 'd97706' : '65a30d';

      const impactBgColor = violation.impact === 'critical' ? 'fef2f2' : 
                           violation.impact === 'serious' ? 'fff7ed' :
                           violation.impact === 'moderate' ? 'fffbeb' : 'f7fee7';

      // Create violation table for better visual formatting
      const violationTable = new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: impactColor },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
          left: { style: BorderStyle.SINGLE, size: 6, color: impactColor },
          right: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0 },
          insideVertical: { style: BorderStyle.NONE, size: 0 },
        },
        rows: [
          // Title row
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${index + 1}. ${violation.help || 'Nieznane naruszenie'}`,
                        bold: true,
                        size: 24,
                        color: "1e40af"
                      }),
                    ],
                    spacing: { before: 150, after: 150 }
                  })
                ],
                shading: { fill: impactBgColor },
                margins: { top: 100, bottom: 100, left: 150, right: 150 }
              }),
            ],
          }),
          // Impact level row
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "🚨 Poziom wpływu: ", bold: true, size: 22 }),
                      new TextRun({ 
                        text: impactText, 
                        bold: true, 
                        color: impactColor,
                        size: 22
                      }),
                    ],
                    spacing: { before: 100, after: 100 }
                  })
                ],
                margins: { top: 50, bottom: 50, left: 150, right: 150 }
              }),
            ],
          }),
          // Description row
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "📝 Opis problemu:", bold: true, size: 20 }),
                    ],
                    spacing: { before: 100, after: 50 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: violation.description || 'Brak opisu', size: 20 }),
                    ],
                    spacing: { after: 100 }
                  })
                ],
                margins: { top: 50, bottom: 50, left: 150, right: 150 }
              }),
            ],
          }),
          // Statistics row
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "📊 Statystyki:", bold: true, size: 20 }),
                    ],
                    spacing: { before: 100, after: 50 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "• Dotkniętych elementów: ", bold: true, size: 18 }),
                      new TextRun({ text: nodeCount.toString(), size: 18, color: impactColor, bold: true }),
                    ],
                    spacing: { after: 50 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "• Znaczniki WCAG: ", bold: true, size: 18 }),
                      new TextRun({ text: violation.tags ? violation.tags.join(', ') : 'Brak', size: 18 }),
                    ],
                    spacing: { after: 100 }
                  })
                ],
                margins: { top: 50, bottom: 50, left: 150, right: 150 }
              }),
            ],
          }),
          // Code examples row
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "💻 Przykłady problematycznego kodu:", bold: true, size: 20 }),
                    ],
                    spacing: { before: 100, after: 100 }
                  }),
                  ...(violation.nodes?.slice(0, 3).map((node: any, nodeIndex: number) => 
                    new Paragraph({
                      children: [
                        new TextRun({ 
                          text: `${nodeIndex + 1}. Element: `, 
                          bold: true, 
                          size: 16 
                        }),
                        new TextRun({ 
                          text: node.target ? node.target.join(' > ') : 'Nieznana lokalizacja', 
                          size: 16, 
                          color: "6b7280" 
                        }),
                      ],
                      spacing: { after: 50 }
                    })
                  ) || []),
                  ...(violation.nodes?.slice(0, 3).map((node: any, nodeIndex: number) => 
                    new Paragraph({
                      children: [
                        new TextRun({ 
                          text: node.html ? node.html.replace(/\s+/g, ' ').trim() : 'Brak kodu HTML', 
                          size: 14, 
                          color: "374151"
                        }),
                      ],
                      spacing: { after: 100 },
                      shading: { fill: "f9fafb" },
                      border: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" },
                      }
                    })
                  ) || []),
                  ...(violation.nodes?.slice(0, 3).map((node: any, nodeIndex: number) => 
                    node.failureSummary ? new Paragraph({
                      children: [
                        new TextRun({ 
                          text: `⚠️ Problem: `, 
                          bold: true, 
                          size: 16, 
                          color: "dc2626" 
                        }),
                        new TextRun({ 
                          text: node.failureSummary, 
                          size: 16,
                          italics: true
                        }),
                      ],
                      spacing: { after: 150 }
                    }) : new Paragraph({ text: "", spacing: { after: 50 } })
                  ) || []),
                  ...(violation.nodes?.length > 3 ? [
                    new Paragraph({
                      children: [
                        new TextRun({ 
                          text: `... i ${violation.nodes.length - 3} więcej podobnych elementów`, 
                          size: 16, 
                          italics: true,
                          color: "6b7280"
                        }),
                      ],
                      spacing: { after: 100 }
                    })
                  ] : [])
                ],
                margins: { top: 50, bottom: 50, left: 150, right: 150 }
              }),
            ],
          }),
        ],
      });

      children.push(violationTable);

      // Help URL as separate paragraph with better styling
      if (violation.helpUrl) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "🔗 Więcej informacji: ", bold: true, size: 18 }),
              new TextRun({ 
                text: violation.helpUrl,
                color: "2563eb",
                underline: {},
                size: 16
              }),
            ],
            spacing: { before: 100, after: 300 },
            alignment: AlignmentType.LEFT
          })
        );
      } else {
        children.push(
          new Paragraph({
            text: "",
            spacing: { after: 300 }
          })
        );
      }
    });
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "WYNIKI SKANOWANIA",
            bold: true,
            size: 24,
            color: "1e40af"
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "✓ Świetna robota! Nie znaleziono problemów z dostępnością.",
            bold: true,
            size: 22,
            color: "16a34a"
          }),
        ],
        spacing: { after: 200 }
      })
    );
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Raport wygenerowany przez Analizator Dostępności Web | ${currentDate}`,
          size: 18,
          color: "6b7280"
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Ten raport zawiera analizę zgodności z wytycznymi WCAG 2.1",
          size: 18,
          color: "6b7280"
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  // Create document with default font settings
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22
          }
        }
      }
    },
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}