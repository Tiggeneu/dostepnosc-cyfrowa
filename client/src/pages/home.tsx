import { useState } from "react";
import Navbar from "@/components/navbar";
import ScanForm from "@/components/scan-form";
import ReportOverview from "@/components/report-overview";
import ViolationsList from "@/components/violations-list";
import { Card } from "@/components/ui/card";

export default function Home() {
  const [currentScanId, setCurrentScanId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4 text-white">Analizator Dostępności Web</h1>
          <p className="text-xl mb-0 text-blue-100">Kompleksowe skanowanie zgodności z WCAG 2.1 napędzane przez axe-core i Puppeteer</p>
        </div>
      </section>

      <div className="container mx-auto px-4">
        {/* Scan Form */}
        <div className="flex justify-center">
          <div className="w-full max-w-4xl">
            <ScanForm onScanInitiated={setCurrentScanId} />
          </div>
        </div>

        {/* Report Sections */}
        {currentScanId && (
          <div className="mt-8">
            <ReportOverview scanId={currentScanId} />
            <ViolationsList scanId={currentScanId} />
          </div>
        )}

        {/* General Recommendations */}
        <div className="mt-8 mb-8">
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-none">
            <h4 className="text-xl font-bold mb-4 flex items-center">
              <span className="text-yellow-500 mr-2">★</span>
              General Recommendations
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Implement skip navigation links
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Ensure keyboard navigation works
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Use semantic HTML elements
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Test with screen readers
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Provide text alternatives
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Maintain focus indicators
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white mt-8 py-6 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-600 mb-4 md:mb-0">
              © 2024 AccessiScan. Powered by axe-core & Puppeteer.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-600 hover:text-gray-800">Privacy Policy</a>
              <a href="#" className="text-gray-600 hover:text-gray-800">Terms of Service</a>
              <a href="#" className="text-gray-600 hover:text-gray-800">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
