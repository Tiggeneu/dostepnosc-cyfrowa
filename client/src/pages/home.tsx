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
          <p className="text-xl mb-0 text-blue-100">Kompleksowe skanowanie zgodności z WCAG 2.1</p>
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
        <div className="mt-8 mb-8 flex justify-center">
          <div className="w-full max-w-4xl">
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-none">
              <h4 className="text-xl font-bold mb-4 flex items-center justify-center">
                <span className="text-yellow-500 mr-2">★</span>
                Ogólne Zalecenia WCAG
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Implementuj linki pomijania nawigacji
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Zapewnij działającą nawigację klawiaturą
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Używaj semantycznych elementów HTML
                  </li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Testuj z czytnikami ekranu
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Zapewnij alternatywy tekstowe
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Utrzymuj wskaźniki fokusu
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white mt-8 py-6 border-t">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600 mb-1">
              © 2025 Analizator Dostępności Web - Testowanie zgodności WCAG 2.1
            </p>
            <p className="text-sm text-gray-500">
              Technologie: axe-core • Puppeteer • pa11y • html-validate • Lighthouse • React • Node.js
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
