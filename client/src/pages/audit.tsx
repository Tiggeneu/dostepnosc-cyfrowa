import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, Minus, Upload, FileImage } from "lucide-react";
import { Link } from "wouter";

export default function AuditPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const [auditorName, setAuditorName] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const { toast } = useToast();

  // Start audit session mutation
  const startAuditMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/audit/start", {
        scanId: parseInt(scanId || "0"),
        auditorName,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.id);
      setIsStarted(true);
      toast({
        title: "Audyt rozpoczęty",
        description: "Sesja audytu manualnego została utworzona pomyślnie.",
      });
    },
    onError: () => {
      toast({
        title: "Błąd",
        description: "Nie udało się rozpocząć audytu manualnego.",
        variant: "destructive",
      });
    },
  });

  // Get audit session data
  const { data: auditSession, isLoading } = useQuery({
    queryKey: [`/api/audit/${currentSessionId}`],
    enabled: !!currentSessionId,
  });

  // Update criteria mutation
  const updateCriteriaMutation = useMutation({
    mutationFn: async ({ criteriaId, status, notes }: { criteriaId: number; status: string; notes?: string }) => {
      const response = await apiRequest("PUT", `/api/audit/criteria/${criteriaId}`, {
        status,
        notes,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries([`/api/audit/${currentSessionId}`]);
      toast({
        title: "Kryterium zaktualizowane",
        description: "Status kryterium został pomyślnie zapisany.",
      });
    },
    onError: () => {
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować kryterium.",
        variant: "destructive",
      });
    },
  });

  if (!isStarted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link href={`/?scanId=${scanId}`}>
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Powrót do wyników skanowania
              </Button>
            </Link>
            <h1 className="text-3xl font-bold mb-2">Audyt Manualny WCAG</h1>
            <p className="text-gray-600">
              Rozpocznij szczegółowy audyt zgodności z kryteriami WCAG 2.1 dla skanowania #{scanId}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Rozpocznij Audyt</CardTitle>
              <CardDescription>
                Wprowadź swoje dane aby rozpocząć sesję audytu manualnego
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Imię i nazwisko audytora
                </label>
                <Input
                  placeholder="np. Jan Kowalski"
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                />
              </div>
              
              <Button
                onClick={() => startAuditMutation.mutate()}
                disabled={!auditorName.trim() || startAuditMutation.isPending}
                className="w-full"
              >
                {startAuditMutation.isPending ? "Rozpoczynam..." : "Rozpocznij Audyt"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading || !auditSession) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Ładowanie sesji audytu...</p>
        </div>
      </div>
    );
  }

  const criteria = auditSession.criteria || [];
  const groupedCriteria = criteria.reduce((acc: any, criterion: any) => {
    const section = criterion.criteriaId.split('.').slice(0, 2).join('.');
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(criterion);
    return acc;
  }, {});

  const sectionNames: { [key: string]: string } = {
    "1.1": "Alternatywa tekstowa",
    "1.2": "Multimedia",
    "1.3": "Możliwość adaptacji", 
    "1.4": "Rozróżnialność",
    "2.1": "Dostępność z klawiatury",
    "2.2": "Wystarczająco dużo czasu",
    "2.3": "Ataki padaczkowe i reakcje fizyczne",
    "2.4": "Możliwość nawigacji",
    "3.1": "Czytelność",
    "3.2": "Przewidywalność",
    "3.3": "Pomoc w wprowadzaniu danych",
    "4.1": "Zgodność",
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Spełnione</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Niespełnione</Badge>;
      case 'not_applicable':
        return <Badge className="bg-gray-100 text-gray-800"><Minus className="w-3 h-3 mr-1" />Nie dotyczy</Badge>;
      default:
        return <Badge variant="outline">Nie ocenione</Badge>;
    }
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      'A': 'bg-green-100 text-green-800',
      'AA': 'bg-orange-100 text-orange-800', 
      'AAA': 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>{level}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/?scanId=${scanId}`}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Powrót do wyników skanowania
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">Audyt Manualny WCAG</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Audytor: <strong>{auditSession.auditorName}</strong></span>
          <span>Skanowanie: <strong>#{scanId}</strong></span>
          <span>Status: <strong>{auditSession.status === 'in_progress' ? 'W trakcie' : 'Zakończony'}</strong></span>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedCriteria).map(([section, sectionCriteria]) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle className="text-xl">
                {section} {sectionNames[section]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(sectionCriteria as any[]).map((criterion) => (
                  <CriterionCard 
                    key={criterion.id}
                    criterion={criterion}
                    onUpdate={(status, notes) => {
                      updateCriteriaMutation.mutate({
                        criteriaId: criterion.id,
                        status,
                        notes,
                      });
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface CriterionCardProps {
  criterion: any;
  onUpdate: (status: string, notes?: string) => void;
}

function CriterionCard({ criterion, onUpdate }: CriterionCardProps) {
  const [notes, setNotes] = useState(criterion.notes || "");
  const [showScreenshots, setShowScreenshots] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Spełnione</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Niespełnione</Badge>;
      case 'not_applicable':
        return <Badge className="bg-gray-100 text-gray-800"><Minus className="w-3 h-3 mr-1" />Nie dotyczy</Badge>;
      default:
        return <Badge variant="outline">Nie ocenione</Badge>;
    }
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      'A': 'bg-green-100 text-green-800',
      'AA': 'bg-orange-100 text-orange-800', 
      'AAA': 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>{level}</Badge>;
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium">{criterion.criteriaId} {criterion.title}</h4>
            {getLevelBadge(criterion.level)}
            {getStatusBadge(criterion.status)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Button
          variant={criterion.status === 'passed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onUpdate('passed', notes)}
          className="w-full"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Spełnione
        </Button>
        <Button
          variant={criterion.status === 'failed' ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => onUpdate('failed', notes)}
          className="w-full"
        >
          <XCircle className="w-4 h-4 mr-1" />
          Niespełnione
        </Button>
        <Button
          variant={criterion.status === 'not_applicable' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onUpdate('not_applicable', notes)}
          className="w-full"
        >
          <Minus className="w-4 h-4 mr-1" />
          Nie dotyczy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowScreenshots(!showScreenshots)}
          className="w-full"
        >
          <FileImage className="w-4 h-4 mr-1" />
          Zrzuty ekranu
        </Button>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Uwagi</label>
        <Textarea
          placeholder="Dodaj uwagi dotyczące tego kryterium..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== criterion.notes) {
              onUpdate(criterion.status, notes);
            }
          }}
        />
      </div>

      {showScreenshots && (
        <ScreenshotManager criteriaId={criterion.id} />
      )}
    </div>
  );
}

interface ScreenshotManagerProps {
  criteriaId: number;
}

function ScreenshotManager({ criteriaId }: ScreenshotManagerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  // Get screenshots for this criteria
  const { data: screenshots, isLoading } = useQuery({
    queryKey: [`/api/audit/criteria/${criteriaId}/screenshots`],
  });

  // Upload screenshot mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Nie wybrano pliku");

      // Convert file to base64 for simple storage
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedFile);
      });

      const response = await apiRequest("POST", `/api/audit/criteria/${criteriaId}/screenshot`, {
        filename: `${criteriaId}_${Date.now()}_${selectedFile.name}`,
        originalName: selectedFile.name,
        description,
        fileData: base64
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/audit/criteria/${criteriaId}/screenshots`] });
      setSelectedFile(null);
      setDescription("");
      toast({
        title: "Zrzut ekranu dodany",
        description: "Plik został pomyślnie przesłany.",
      });
    },
    onError: () => {
      toast({
        title: "Błąd przesyłania",
        description: "Nie udało się przesłać zrzutu ekranu.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Nieprawidłowy typ pliku",
          description: "Można przesyłać tylko pliki obrazów (JPG, PNG, GIF, etc.).",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Plik za duży",
          description: "Maksymalny rozmiar pliku to 5MB.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  return (
    <div className="border-t pt-3">
      <h5 className="font-medium mb-3">Zrzuty ekranu</h5>
      
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-sm font-medium mb-1 block">
            Wybierz plik obrazu
          </label>
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="cursor-pointer"
          />
        </div>
        
        {selectedFile && (
          <>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Opis zrzutu ekranu (opcjonalnie)
              </label>
              <Input
                placeholder="np. Problem z kontrastem przycisku"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending}
                size="sm"
              >
                <Upload className="w-4 h-4 mr-1" />
                {uploadMutation.isPending ? "Przesyłanie..." : "Prześlij"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setDescription("");
                }}
              >
                Anuluj
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}
        
        {screenshots && screenshots.length > 0 ? (
          screenshots.map((screenshot: any) => (
            <div key={screenshot.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex items-center gap-2">
                <FileImage className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="text-sm font-medium">{screenshot.originalName}</div>
                  {screenshot.description && (
                    <div className="text-xs text-gray-500">{screenshot.description}</div>
                  )}
                  <div className="text-xs text-gray-400">
                    {new Date(screenshot.uploadedAt).toLocaleString('pl-PL')}
                  </div>
                </div>
              </div>
              <Button
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Delete functionality would be implemented here
                  toast({
                    title: "Funkcja usuwania",
                    description: "Zostanie wkrótce dodana.",
                  });
                }}
                className="text-red-600 hover:text-red-700"
              >
                Usuń
              </Button>
            </div>
          ))
        ) : (
          !isLoading && (
            <div className="text-center py-4 text-gray-500">
              <FileImage className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Brak zrzutów ekranu dla tego kryterium</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}