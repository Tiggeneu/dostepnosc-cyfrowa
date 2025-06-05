import { useState } from "react";
import { ChevronDown, CheckCircle, Settings, FileText, Globe } from "lucide-react";

export default function Navbar() {
  const [showFunctionsMenu, setShowFunctionsMenu] = useState(false);

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <a href="#" className="flex items-center space-x-2 text-xl font-bold text-blue-600">
            <span className="text-2xl">♿</span>
            <span>Analizator Dostępności</span>
          </a>
          <div className="hidden md:flex space-x-8 relative">
            <div className="relative">
              <button
                onClick={() => setShowFunctionsMenu(!showFunctionsMenu)}
                className="flex items-center text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                Funkcje
                <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${showFunctionsMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showFunctionsMenu && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border z-50">
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Możliwości Programu</h3>
                      <div className="flex items-center mb-3">
                        <div className="bg-blue-100 rounded-full px-3 py-1 mr-3">
                          <span className="text-sm font-bold text-blue-700">WCAG 2.1</span>
                        </div>
                        <div className="text-sm text-gray-600">Poziomy A/AA/AAA</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Skanowanie Dostępności</div>
                          <div className="text-xs text-gray-500">7 kategorii testów z axe-core i fallback HTML</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <FileText className="h-4 w-4 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Raport Word</div>
                          <div className="text-xs text-gray-500">Profesjonalny dokument z pełną listą WCAG</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <Globe className="h-4 w-4 text-purple-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Polskie Tłumaczenia</div>
                          <div className="text-xs text-gray-500">Wszystkie komunikaty w języku polskim</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <Settings className="h-4 w-4 text-orange-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Backup Systemy</div>
                          <div className="text-xs text-gray-500">Fallback gdy Puppeteer niedostępny</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t">
                      <div className="text-xs text-gray-500 mb-2">Narzędzia:</div>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">axe-core</span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Puppeteer</span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">pa11y</span>
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">html-validate</span>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Lighthouse</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <a href="#documentation" className="text-gray-600 hover:text-gray-800">Dokumentacja</a>
            <a href="#about" className="text-gray-600 hover:text-gray-800">O nas</a>
          </div>
        </div>
      </div>
      
      {/* Overlay to close dropdown when clicking outside */}
      {showFunctionsMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowFunctionsMenu(false)}
        />
      )}
    </nav>
  );
}
