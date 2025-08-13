import fs from 'fs';
import path from 'path';

const RESULTS_DIR = path.join(process.cwd(), 'scan-results');

// Create results directory if it doesn't exist
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

export const storage = {
  saveScanResult: async (result: any) => {
    const fileName = `scan-${Date.now()}.json`;
    const filePath = path.join(RESULTS_DIR, fileName);
    await fs.promises.writeFile(filePath, JSON.stringify(result, null, 2));
    return fileName;
  },

  getScanResult: async (fileName: string) => {
    const filePath = path.join(RESULTS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  },

  getAllScanResults: async () => {
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