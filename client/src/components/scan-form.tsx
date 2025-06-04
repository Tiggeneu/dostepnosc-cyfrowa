import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";

interface ScanFormProps {
  onScanInitiated: (scanId: number) => void;
}

export default function ScanForm({ onScanInitiated }: ScanFormProps) {
  const [url, setUrl] = useState("");
  const [currentScanId, setCurrentScanId] = useState<number | null>(null);
  const { toast } = useToast();

  // Start scan mutation
  const scanMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/scan", { url });
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
    queryKey: ["/api/scan", currentScanId],
    enabled: !!currentScanId,
    refetchInterval: (data) => {
      // Stop polling when scan is complete or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

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
      scanMutation.mutate(url);
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
        <div className="grid md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-3">
            <Label htmlFor="urlInput" className="text-sm font-semibold">
              Website URL
            </Label>
            <Input
              id="urlInput"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="url-input mt-1"
              disabled={isScanning}
            />
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
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Analyze Website
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
              <strong>Scan failed:</strong> {scanResult.errorMessage || 'An unexpected error occurred.'}
            </p>
          </div>
        )}
      </form>
    </Card>
  );
}
