import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ScanResult } from '../shared/schema';

const RESULTS_DIR = path.join(process.cwd(), 'scan-results');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

export const storage = {
  saveScanResult: async (result: Partial<ScanResult>): Promise<ScanResult> => {
    const id = uuidv4();
    const scanResult: ScanResult = {
      id,
      url: result.url || '',
      status: result.status || 'pending',
      violations: result.violations || [],
      passedTests: result.passedTests || 0,
      elementsScanned: result.elementsScanned || 0,
      complianceScore: result.complianceScore || 0,
      wcagLevel: result.wcagLevel || 'AA',
      scanDate: new Date().toISOString(),
      errorMessage: result.errorMessage
    };

    const filePath = path.join(RESULTS_DIR, `${id}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(scanResult, null, 2));
    return scanResult;
  },

  getScanResult: async (id: string): Promise<ScanResult | null> => {
    const filePath = path.join(RESULTS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  },

  updateScanResult: async (id: string, updates: Partial<ScanResult>): Promise<ScanResult | null> => {
    const filePath = path.join(RESULTS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const currentResult = JSON.parse(content);
    const updatedResult = { ...currentResult, ...updates };
    
    await fs.promises.writeFile(filePath, JSON.stringify(updatedResult, null, 2));
    return updatedResult;
  },

  getAllScanResults: async (): Promise<ScanResult[]> => {
    const files = await fs.promises.readdir(RESULTS_DIR);
    const results = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async (file) => {
          const content = await fs.promises.readFile(path.join(RESULTS_DIR, file), 'utf-8');
          return JSON.parse(content);
        })
    );
    return results;
  }
};
