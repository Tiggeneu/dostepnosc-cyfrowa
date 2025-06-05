import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb, ExternalLink } from "lucide-react";
import type { Violation } from "@shared/schema";

interface ViolationsListProps {
  scanId: number;
}

export default function ViolationsList({ scanId }: ViolationsListProps) {
  const { data: scanResult } = useQuery({
    queryKey: [`/api/scan/${scanId}`],
    enabled: !!scanId,
  });

  if (!scanResult || scanResult.status !== 'completed') {
    return null;
  }

  const violations: Violation[] = scanResult.violations || [];

  if (violations.length === 0) {
    return (
      <div className="report-section mt-8">
        <Card className="p-8 text-center">
          <div className="text-green-600 text-4xl mb-4">✓</div>
          <h3 className="text-xl font-bold mb-2">Nie znaleziono naruszeń dostępności!</h3>
          <p className="text-gray-600">Ta strona internetowa wydaje się być zgodna z wytycznymi dostępności WCAG 2.1.</p>
        </Card>
      </div>
    );
  }

  const getSeverityColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'serious': return 'border-l-orange-500 bg-orange-50';
      case 'moderate': return 'border-l-yellow-500 bg-yellow-50';
      case 'minor': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getSeverityBadgeColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'serious': return 'bg-orange-100 text-orange-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'minor': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const translateImpact = (impact: string) => {
    switch (impact) {
      case 'critical': return 'KRYTYCZNY';
      case 'serious': return 'POWAŻNY';
      case 'moderate': return 'UMIARKOWANY';
      case 'minor': return 'DROBNY';
      default: return impact.toUpperCase();
    }
  };

  const getWcagReference = (tags: string[]) => {
    const wcagTag = tags.find(tag => tag.startsWith('wcag'));
    return wcagTag ? wcagTag.replace('wcag', 'WCAG ').toUpperCase() : 'WCAG';
  };

  const getWcagLevel = (tags: string[]) => {
    if (tags.some(tag => tag.includes('wcag2aaa'))) return 'AAA';
    if (tags.some(tag => tag.includes('wcag2aa'))) return 'AA';
    if (tags.some(tag => tag.includes('wcag2a'))) return 'A';
    return 'A'; // domyślnie poziom A
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'AA': return 'bg-orange-100 text-orange-800';
      case 'AAA': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="report-section mt-8">
      <h3 className="text-xl font-bold mb-6">Naruszenia Dostępności</h3>
      
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Struktura wyników:</strong> Każde naruszenie może zawierać wiele elementów HTML. 
          Liczba obok nazwy naruszenia pokazuje ile konkretnych elementów ma ten sam problem.
        </p>
      </div>
      
      <div className="space-y-6">
        {violations.map((violation, index) => (
          <Card 
            key={`${violation.id}-${index}`} 
            className={`violation-card border-l-4 p-6 ${getSeverityColor(violation.impact)}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h5 className="text-lg font-semibold mb-2">{violation.help}</h5>
                <div className="flex gap-2 mb-2">
                  <Badge className={`${getSeverityBadgeColor(violation.impact)} text-xs font-semibold`}>
                    {translateImpact(violation.impact)}
                  </Badge>
                  <Badge className={`${getLevelColor(getWcagLevel(violation.tags))} text-xs font-semibold`}>
                    WCAG {getWcagLevel(violation.tags)}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {violation.nodes.length} element{violation.nodes.length !== 1 ? 'ów' : ''}
                </div>
                <small className="text-gray-600">{getWcagReference(violation.tags)}</small>
              </div>
            </div>
            
            <p className="text-gray-700 mb-4">{violation.description}</p>

            {violation.nodes.length > 0 && (
              <div className="mb-4">
                <h6 className="font-semibold mb-2">Dotknięte Elementy:</h6>
                <div className="code-snippet bg-gray-100 border rounded-lg p-3 overflow-x-auto">
                  <pre className="text-sm">
                    {violation.nodes.slice(0, 3).map((node, nodeIndex) => (
                      <div key={nodeIndex} className="mb-1">
                        {node.html.length > 100 ? `${node.html.substring(0, 100)}...` : node.html}
                      </div>
                    ))}
                    {violation.nodes.length > 3 && (
                      <div className="text-gray-600 text-xs mt-2">
                        ... i {violation.nodes.length - 3} więcej element{violation.nodes.length - 3 !== 1 ? 'ów' : ''}
                      </div>
                    )}
                  </pre>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h6 className="font-semibold mb-2 flex items-center">
                <Lightbulb className="w-4 h-4 text-yellow-500 mr-2" />
                Jak Naprawić Ten Problem:
              </h6>
              <p className="text-sm text-gray-700 mb-2">
                {violation.description}
              </p>
              <a 
                href={violation.helpUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
              >
                Dowiedz się więcej o tej regule
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </Card>
        ))}
      </div>

      {violations.length > 0 && (
        <div className="text-center mt-6">
          <p className="text-gray-600">
            Wyświetlono wszystkie {violations.length} naruszeni{violations.length === 1 ? 'e' : violations.length < 5 ? 'a' : 'ń'}
          </p>
        </div>
      )}
    </div>
  );
}
