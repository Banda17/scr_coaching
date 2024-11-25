import { useState, useRef } from "react";
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

const locationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  code: z.string().min(1, "Location code is required").max(10, "Code too long")
});

type LocationFormData = z.infer<typeof locationSchema>;

export default function LocationManagementPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLocation, setNewLocation] = useState<LocationFormData>({ name: "", code: "" });
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

  const handleSubmit = async (e: React.FormEvent) => {
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
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file type and size
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        throw new Error("Invalid file format. Please upload an Excel file (.xlsx or .xls)");
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error("File size too large. Maximum size is 5MB");
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch("/api/locations/import", {
          method: "POST",
          body: formData,
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Invalid server response format");
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to import locations");
        }

        if (typeof data !== 'object' || !('imported' in data)) {
          throw new Error("Invalid response format from server");
        }

        return data;
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error("Invalid JSON response from server");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      
      // Format detailed success message
      let successMessage = `Successfully imported ${data.imported} location${data.imported !== 1 ? 's' : ''}`;
      
      if (data.errors?.length) {
        const errorCount = data.errors.length;
        toast({
          title: "Import Completed with Warnings",
          description: `${successMessage}. ${errorCount} error${errorCount !== 1 ? 's' : ''} occurred.`,
          variant: "destructive"
        });
        
        // Log detailed errors for debugging
        console.group("Import Errors");
        data.errors.forEach((error: string, index: number) => {
          console.error(`Error ${index + 1}:`, error);
        });
        console.groupEnd();
      } else {
        toast({
          title: "Import Successful",
          description: successMessage
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    
    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  return (
    <div className="container mx-auto p-4">
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
    </div>
  );
}
