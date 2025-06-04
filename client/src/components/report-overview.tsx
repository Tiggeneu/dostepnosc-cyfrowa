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
    mutationFn: async (format: 'pdf' | 'json' | 'csv') => {
      const response = await apiRequest("POST", "/api/export", { scanId, format });
      
      if (format === 'pdf') {
        return await response.blob();
      } else if (format === 'csv') {
        return await response.text();
      } else {
        return await response.json();
      }
    },
    onSuccess: (data, format) => {
      let blob: Blob;
      let filename: string;
      
      if (format === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `accessibility-report-${scanId}.json`;
      } else if (format === 'pdf') {
        blob = data as Blob;
        filename = `accessibility-report-${scanId}.pdf`;
      } else if (format === 'csv') {
        blob = new Blob([data as string], { type: 'text/csv' });
        filename = `accessibility-report-${scanId}.csv`;
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
        title: "Export Successful",
        description: `Report exported as ${format.toUpperCase()}`,
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export the report. Please try again.",
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
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate('pdf')}
            disabled={exportMutation.isPending}
          >
            <FileText className="w-4 h-4 mr-2" />
            Eksportuj PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate('csv')}
            disabled={exportMutation.isPending}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Eksportuj CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate('json')}
            disabled={exportMutation.isPending}
          >
            <Code className="w-4 h-4 mr-2" />
            Eksportuj JSON
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="metric-card text-center p-6">
          <div className="metric-number text-red-600 text-4xl font-bold">
            {totalViolations}
          </div>
          <div className="font-semibold mt-2">Total Violations</div>
          <small className="text-gray-600">WCAG 2.1 Issues</small>
        </Card>
        
        <Card className="metric-card text-center p-6">
          <div className="metric-number text-green-600 text-4xl font-bold">
            {scanResult.passedTests || 0}
          </div>
          <div className="font-semibold mt-2">Passed Tests</div>
          <small className="text-gray-600">Compliant Elements</small>
        </Card>
        
        <Card className="metric-card text-center p-6">
          <div className="metric-number text-blue-600 text-4xl font-bold">
            {scanResult.elementsScanned || 0}
          </div>
          <div className="font-semibold mt-2">Elements Scanned</div>
          <small className="text-gray-600">Total DOM Nodes</small>
        </Card>
        
        <Card className="metric-card text-center p-6">
          <div className="metric-number text-yellow-600 text-4xl font-bold">
            {scanResult.complianceScore || 0}%
          </div>
          <div className="font-semibold mt-2">Compliance Score</div>
          <small className="text-gray-600">WCAG 2.1 AA</small>
        </Card>
      </div>
    </div>
  );
}
