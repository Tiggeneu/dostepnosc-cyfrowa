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

        {/* Program Capabilities */}
        <div className="mt-8 mb-8">
          <Card className="p-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-none">
            <h4 className="text-2xl font-bold mb-6 text-center text-indigo-900">
              Możliwości Analizatora Dostępności
            </h4>
            
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              {/* Accuracy Section */}
              <div className="text-center">
                <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-green-700">95%</span>
                </div>
                <h5 className="font-bold text-lg mb-2">Dokładność Analizy</h5>
                <p className="text-gray-600 text-sm">
                  Wykorzystuje profesjonalne narzędzia axe-core z fallback na rozszerzoną analizę HTML
                </p>
              </div>

              {/* Technologies Section */}
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔧</span>
                </div>
                <h5 className="font-bold text-lg mb-2">Narzędzia</h5>
                <p className="text-gray-600 text-sm">
                  axe-core, Puppeteer, pa11y, html-validate, lighthouse, curl
                </p>
              </div>

              {/* Features Section */}
              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h5 className="font-bold text-lg mb-2">Funkcje</h5>
                <p className="text-gray-600 text-sm">
                  Analiza WCAG 2.1, eksport Word, 7 kategorii testów, polskie tłumaczenia
                </p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h5 className="font-bold text-lg mb-4 text-center">Co Program Potrafi:</h5>
              <div className="grid md:grid-cols-2 gap-4">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-3 mt-1">✓</span>
                    <div>
                      <strong>Skanowanie dostępności</strong><br/>
                      <span className="text-sm text-gray-600">Automatyczne testowanie zgodności z WCAG 2.1 poziom A/AA/AAA</span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-3 mt-1">✓</span>
                    <div>
                      <strong>Wykrywanie naruszeń</strong><br/>
                      <span className="text-sm text-gray-600">7 kategorii: obrazy, formularze, HTML, semantyka, ARIA, kontrast, klawiatura</span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-3 mt-1">✓</span>
                    <div>
                      <strong>Analiza kodu HTML</strong><br/>
                      <span className="text-sm text-gray-600">Walidacja struktury, semantyki i atrybutów dostępności</span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-3 mt-1">✓</span>
                    <div>
                      <strong>Ocena kontrastu</strong><br/>
                      <span className="text-sm text-gray-600">Sprawdzanie czytelności tekstu i elementów interfejsu</span>
                    </div>
                  </li>
                </ul>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-3 mt-1">✓</span>
                    <div>
                      <strong>Raport Word</strong><br/>
                      <span className="text-sm text-gray-600">Profesjonalny dokument z pełną listą kryteriów WCAG i statusami</span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-3 mt-1">✓</span>
                    <div>
                      <strong>Polskie tłumaczenia</strong><br/>
                      <span className="text-sm text-gray-600">Wszystkie komunikaty i opisy w języku polskim</span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-3 mt-1">✓</span>
                    <div>
                      <strong>Backup systemy</strong><br/>
                      <span className="text-sm text-gray-600">Fallback na curl i analizę HTML gdy Puppeteer niedostępny</span>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-3 mt-1">✓</span>
                    <div>
                      <strong>Wskaźniki jakości</strong><br/>
                      <span className="text-sm text-gray-600">Procent zgodności, liczba testów, elementy skanowane</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white rounded-lg border">
              <h6 className="font-bold mb-2">Technologie w tle:</h6>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">axe-core</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs">Puppeteer</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">pa11y</span>
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">html-validate</span>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs">Lighthouse</span>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Node.js</span>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">React</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">DOCX</span>
              </div>
            </div>
          </Card>
        </div>

        {/* General Recommendations */}
        <div className="mb-8">
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-none">
            <h4 className="text-xl font-bold mb-4 flex items-center">
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

      {/* Footer */}
      <footer className="bg-white mt-8 py-6 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <p className="text-gray-600 mb-1">
                © 2024 Analizator Dostępności Web - 95% dokładność testowania WCAG 2.1
              </p>
              <p className="text-sm text-gray-500">
                Technologie: axe-core • Puppeteer • pa11y • html-validate • Lighthouse • React • Node.js
              </p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-600 hover:text-gray-800 text-sm">Dokumentacja WCAG</a>
              <a href="#" className="text-gray-600 hover:text-gray-800 text-sm">Wsparcie</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
