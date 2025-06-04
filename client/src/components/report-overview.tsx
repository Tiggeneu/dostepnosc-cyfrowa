import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Code, FileSpreadsheet } from "lucide-react";

interface ReportOverviewProps {
  scanId: number;
}

export default function ReportOverview({ scanId }: ReportOverviewProps) {
  const { toast } = useToast();

  const { data: scanResult } = useQuery({
    queryKey: [`/api/scan/${scanId}`],
    enabled: !!scanId,
  });

  const exportMutation = useMutation({
    mutationFn: async (format: 'pdf' | 'json' | 'csv' | 'docx') => {
      const response = await apiRequest("POST", "/api/export", { scanId, format });
      
      // Check content type to determine how to handle response
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else if (contentType?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        return await response.arrayBuffer();
      } else {
        return await response.text();
      }
    },
    onSuccess: (data, format) => {
      let blob: Blob;
      let filename: string;
      
      if (format === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `raport-dostepnosci-${scanId}.json`;
      } else if (format === 'pdf') {
        blob = new Blob([data as string], { type: 'text/html' });
        filename = `raport-dostepnosci-${scanId}.html`;
      } else if (format === 'csv') {
        blob = new Blob([data as string], { type: 'text/csv' });
        filename = `raport-dostepnosci-${scanId}.csv`;
      } else if (format === 'docx') {
        blob = new Blob([data as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        filename = `raport-dostepnosci-${scanId}.docx`;
      } else {
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Eksport Zakończony Pomyślnie",
        description: `Raport wyeksportowany jako ${format.toUpperCase()}`,
      });
    },
    onError: () => {
      toast({
        title: "Błąd Eksportu",
        description: "Nie udało się wyeksportować raportu. Spróbuj ponownie.",
        variant: "destructive",
      });
    },
  });

  if (!scanResult || scanResult.status !== 'completed') {
    return null;
  }

  const violations = scanResult.violations || [];
  const totalViolations = violations.length;

  return (
    <div className="report-section">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Raport Dostępności</h2>
          <p className="text-gray-600">
            Przeskanowano: <span className="font-medium">{scanResult.url}</span> • 
            <span className="ml-1">{new Date(scanResult.scanDate).toLocaleString('pl-PL')}</span>
          </p>
        </div>
        <div className="flex justify-center mt-4 md:mt-0">
          <Button
            variant="default"
            size="lg"
            onClick={() => exportMutation.mutate('docx')}
            disabled={exportMutation.isPending}
            className="px-8 py-3"
          >
            <FileText className="w-5 h-5 mr-3" />
            Pobierz Raport Word
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="metric-card text-center p-6">
          <div className="metric-number text-red-600 text-4xl font-bold">
            {totalViolations}
          </div>
          <div className="font-semibold mt-2">Łączne naruszenia</div>
          <small className="text-gray-600">Problemy WCAG 2.1</small>
        </Card>
        
        <Card className="metric-card text-center p-6">
          <div className="metric-number text-green-600 text-4xl font-bold">
            {scanResult.passedTests || 0}
          </div>
          <div className="font-semibold mt-2">Zaliczone testy</div>
          <small className="text-gray-600">Zgodne elementy</small>
        </Card>
        
        <Card className="metric-card text-center p-6">
          <div className="metric-number text-blue-600 text-4xl font-bold">
            {scanResult.elementsScanned || 0}
          </div>
          <div className="font-semibold mt-2">Przeskanowane elementy</div>
          <small className="text-gray-600">Łączne węzły DOM</small>
        </Card>
        
        <Card className="metric-card text-center p-6">
          <div className="metric-number text-yellow-600 text-4xl font-bold">
            {scanResult.complianceScore || 0}%
          </div>
          <div className="font-semibold mt-2">Wynik zgodności</div>
          <small className="text-gray-600">WCAG 2.1 AA</small>
        </Card>
      </div>
    </div>
  );
}
