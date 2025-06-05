import { useState } from "react";
import { ChevronDown, CheckCircle, Settings, FileText, Globe, BookOpen, ExternalLink } from "lucide-react";

export default function Navbar() {
  const [showFunctionsMenu, setShowFunctionsMenu] = useState(false);
  const [showDocumentationMenu, setShowDocumentationMenu] = useState(false);

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
            
            <div className="relative">
              <button
                onClick={() => setShowDocumentationMenu(!showDocumentationMenu)}
                className="flex items-center text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                Dokumentacja
                <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${showDocumentationMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showDocumentationMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Dokumentacja WCAG</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Przewodnik po standardach dostępności internetowej
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <BookOpen className="h-4 w-4 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">WCAG 2.1 Poziom A</div>
                          <div className="text-xs text-gray-500">Podstawowe wymagania dostępności</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <BookOpen className="h-4 w-4 text-orange-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">WCAG 2.1 Poziom AA</div>
                          <div className="text-xs text-gray-500">Standard dla większości stron internetowych</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <BookOpen className="h-4 w-4 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">WCAG 2.1 Poziom AAA</div>
                          <div className="text-xs text-gray-500">Najwyższy poziom dostępności</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t">
                      <div className="space-y-2">
                        <a 
                          href="https://www.w3.org/WAI/WCAG21/quickref/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <ExternalLink className="w-3 h-3 mr-2" />
                          Oficjalna dokumentacja WCAG 2.1
                        </a>
                        <a 
                          href="https://www.gov.pl/web/dostepnosc-cyfrowa" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <ExternalLink className="w-3 h-3 mr-2" />
                          Dostępność cyfrowa - gov.pl
                        </a>
                        <a 
                          href="https://www.deque.com/axe/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <ExternalLink className="w-3 h-3 mr-2" />
                          Dokumentacja axe-core
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Overlay to close dropdown when clicking outside */}
      {(showFunctionsMenu || showDocumentationMenu) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowFunctionsMenu(false);
            setShowDocumentationMenu(false);
          }}
        />
      )}
    </nav>
  );
}
