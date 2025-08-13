import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage';
import type { ScanRequest } from '../shared/schema';
import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist/public')));

// API routes
app.post('/api/scan', async (req, res) => {
  try {
    const { url, wcagLevel = 'AA' } = req.body as ScanRequest;
    
    // Create initial scan record
    const scanResult = await storage.saveScanResult({
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

    res.json({
      scanId: scanResult.id,
      status: 'pending',
      message: 'Scan initiated successfully'
    });
  } catch (error) {
    console.error('Error initiating scan:', error);
    res.status(500).json({ message: 'Failed to initiate scan' });
  }
});

app.get('/api/scan/:id', async (req, res) => {
  try {
    const scanResult = await storage.getScanResult(req.params.id);
    if (!scanResult) {
      return res.status(404).json({ message: 'Scan not found' });
    }
    res.json(scanResult);
  } catch (error) {
    console.error('Error retrieving scan result:', error);
    res.status(500).json({ message: 'Failed to retrieve scan result' });
  }
});

async function performAccessibilityScan(scanId: string, url: string, wcagLevel: 'A' | 'AA' | 'AAA' = 'AA') {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const results = await new AxePuppeteer(page).analyze();

    const violations = results.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      tags: violation.tags,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map(node => ({
        html: node.html,
        target: node.target,
        failureSummary: node.failureSummary
      }))
    }));

    const passedTests = results.passes?.length || 0;
    const elementsScanned = await page.evaluate(() => document.querySelectorAll('*').length);
    const complianceScore = Math.round((passedTests / (passedTests + violations.length)) * 100);

    await browser.close();

    await storage.updateScanResult(scanId, {
      status: 'completed',
      violations,
      passedTests,
      elementsScanned,
      complianceScore,
    });
  } catch (error) {
    console.error('Error during accessibility scan:', error);
    await storage.updateScanResult(scanId, {
      status: 'failed',
      errorMessage: 'Failed to complete accessibility scan'
    });
  }
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
