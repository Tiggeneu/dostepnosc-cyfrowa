import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Info } from "lucide-react";

interface ScanFormProps {
  onScanInitiated: (scanId: number) => void;
}

export default function ScanForm({ onScanInitiated }: ScanFormProps) {
  const [url, setUrl] = useState("");
  const [wcagLevel, setWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [currentScanId, setCurrentScanId] = useState<number | null>(null);
  const { toast } = useToast();

  // Start scan mutation
  const scanMutation = useMutation({
    mutationFn: async (data: { url: string; wcagLevel: 'A' | 'AA' | 'AAA' }) => {
      const response = await apiRequest("POST", "/api/scan", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setCurrentScanId(data.scanId);
      onScanInitiated(data.scanId);
      toast({
        title: "Scan Started",
        description: "Your accessibility scan has been initiated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to start the accessibility scan.",
        variant: "destructive",
      });
    },
  });

  // Poll scan status
  const { data: scanResult, isLoading: isScanLoading } = useQuery({
    queryKey: [`/api/scan/${currentScanId}`],
    enabled: !!currentScanId,
    refetchInterval: (query) => {
      // Stop polling when scan is complete or failed
      if (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Show scan results when complete
  useEffect(() => {
    console.log('Scan result:', scanResult);
    if (scanResult?.status === 'completed' && currentScanId) {
      console.log('Triggering scan completion for ID:', currentScanId);
      onScanInitiated(currentScanId);
    }
  }, [scanResult?.status, currentScanId, onScanInitiated]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid website URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      new URL(url);
      scanMutation.mutate({ url, wcagLevel });
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid website URL starting with http:// or https://",
        variant: "destructive",
      });
    }
  };

  const isScanning = scanMutation.isPending || (scanResult?.status === 'pending');
  const scanProgress = isScanning ? 50 : scanResult?.status === 'completed' ? 100 : 0;

  return (
    <Card className="scan-card p-6 -mt-8 relative z-10">
      <form onSubmit={handleSubmit}>
        <div className="grid md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-3">
            <Label htmlFor="urlInput" className="text-sm font-semibold">
              URL strony internetowej
            </Label>
            <Input
              id="urlInput"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://przykład.pl"
              className="url-input mt-1"
              disabled={isScanning}
            />
          </div>
          <div>
            <Label htmlFor="wcagLevel" className="text-sm font-semibold flex items-center">
              Poziom WCAG
              <Info className="w-3 h-3 ml-1 text-gray-400" />
            </Label>
            <Select value={wcagLevel} onValueChange={(value: 'A' | 'AA' | 'AAA') => setWcagLevel(value)} disabled={isScanning}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Poziom A (Podstawowy)</SelectItem>
                <SelectItem value="AA">Poziom AA (Standardowy)</SelectItem>
                <SelectItem value="AAA">Poziom AAA (Zaawansowany)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button
              type="submit"
              className="scan-button w-full"
              disabled={isScanning}
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Skanowanie...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Analizuj stronę
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress Section */}
        {isScanning && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Scanning progress</span>
              <span className="text-sm text-gray-600">{scanProgress}%</span>
            </div>
            <Progress value={scanProgress} className="h-2" />
            <div className="text-center mt-3">
              <small className="text-gray-600">
                {scanResult?.status === 'pending' ? 'Analyzing accessibility violations...' : 'Initializing scan...'}
              </small>
            </div>
          </div>
        )}

        {/* Error State */}
        {scanResult?.status === 'failed' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              <strong>Scan failed:</strong> {scanResult?.errorMessage || 'An unexpected error occurred.'}
            </p>
          </div>
        )}
      </form>
    </Card>
  );
}
