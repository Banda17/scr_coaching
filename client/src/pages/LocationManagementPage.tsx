import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { Location } from "@db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";
import { z } from "zod";

interface ImportResponse {
  success: boolean;
  imported: number;
  total: number;
  errors?: Array<{
    row: number;
    message: string;
    data?: any;
  }>;
  summary: string;
}

const locationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  code: z.string().min(1, "Location code is required").max(10, "Code too long")
});

type LocationFormData = z.infer<typeof locationSchema>;

export default function LocationManagementPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLocation, setNewLocation] = useState<LocationFormData>({ name: "", code: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations, isLoading } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await fetch("/api/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (locationData: LocationFormData) => {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locationData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create location");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setIsDialogOpen(false);
      setNewLocation({ name: "", code: "" });
      toast({
        title: "Success",
        description: "Location created successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const importMutation = useMutation<ImportResponse, Error, File>({
    mutationFn: async (file: File) => {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      if (!file.name.match(/\.(xlsx|xls)$/i) || !validTypes.includes(file.type)) {
        throw new Error("Invalid file format. Please upload an Excel file (.xlsx or .xls)");
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error("File size too large. Maximum size is 5MB");
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch("/api/locations/import", {
          method: "POST",
          body: formData,
        });

        // Check for non-JSON response
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned an invalid response format");
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to import locations");
        }

        return data;
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error("Failed to parse server response");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      
      if (data.errors?.length) {
        toast({
          title: "Import Completed with Issues",
          description: `Imported ${data.imported} locations. ${data.errors.length} errors occurred.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${data.imported} locations`
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validatedData = locationSchema.parse(newLocation);
      createMutation.mutate(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    }
  }, [newLocation, createMutation, toast]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({
        title: "Upload Error",
        description: "No file selected",
        variant: "destructive"
      });
      return;
    }

    importMutation.mutate(file);
    event.target.value = '';
  }, [importMutation, toast]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const isImporting = importMutation.isPending;

  return (
    <div className="container mx-auto p-4">
      {isImporting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-center">Importing locations...</p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Location Management</h1>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button 
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import Locations
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add Location</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Location</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location Name</label>
                  <Input
                    value={newLocation.name}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter location name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location Code</label>
                  <Input
                    value={newLocation.code}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="Enter location code"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create Location
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations?.map((location) => (
            <TableRow key={location.id}>
              <TableCell>{location.id}</TableCell>
              <TableCell>{location.name}</TableCell>
              <TableCell>{location.code}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
