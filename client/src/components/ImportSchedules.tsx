import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Schedule, Train, Location } from "@db/schema";
import { z } from "zod";

const importScheduleSchema = z.object({
  trainId: z.number(),
  departureLocationId: z.number(),
  arrivalLocationId: z.number(),
  scheduledDeparture: z.string().transform(str => new Date(str)),
  scheduledArrival: z.string().transform(str => new Date(str)),
  status: z.enum(['scheduled', 'delayed', 'completed', 'cancelled']).default('scheduled'),
  isCancelled: z.boolean().default(false),
  runningDays: z.array(z.boolean()).length(7).default(Array(7).fill(true)),
  effectiveStartDate: z.string().transform(str => new Date(str)),
  effectiveEndDate: z.string().nullable().optional(),
});

type ImportedSchedule = z.infer<typeof importScheduleSchema>;

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: ImportedSchedule;
}

export default function ImportSchedules() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const validateSchedule = async (schedule: ImportedSchedule): Promise<ValidationResult> => {
    const errors: string[] = [];
    
    // Basic validation using our schema
    try {
      const result = importScheduleSchema.safeParse(schedule);
      if (!result.success) {
        return {
          isValid: false,
          errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }

      const validatedSchedule = result.data;

      // Parse dates with validation
      let scheduledDeparture: Date, scheduledArrival: Date, 
          effectiveStartDate: Date, effectiveEndDate: Date | null = null;

      // Additional validation for dates
      if (validatedSchedule.scheduledArrival.getTime() <= validatedSchedule.scheduledDeparture.getTime()) {
        errors.push('Arrival time must be after departure time');
      }

      if (validatedSchedule.effectiveEndDate && 
          new Date(validatedSchedule.effectiveEndDate).getTime() <= validatedSchedule.effectiveStartDate.getTime()) {
        errors.push('Effective end date must be after start date');
      }

      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      return {
        isValid: true,
        errors: [],
        data: validatedSchedule
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JSON file (.json)",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("File size exceeds 5MB limit");
      }

      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error("Invalid JSON format. Please check the file contents.");
      }
      
      // Validate the imported data structure
      const scheduleImportSchema = z.array(z.object({
        trainId: z.number().int().positive("Train ID must be a positive number"),
        departureLocationId: z.number().int().positive("Departure location ID must be a positive number"),
        arrivalLocationId: z.number().int().positive("Arrival location ID must be a positive number"),
        scheduledDeparture: z.string().datetime("Invalid departure time format"),
        scheduledArrival: z.string().datetime("Invalid arrival time format"),
        status: z.enum(['scheduled', 'delayed', 'completed', 'cancelled']).default('scheduled'),
        isCancelled: z.boolean().default(false),
        runningDays: z.array(z.boolean()).length(7).default(Array(7).fill(true)),
        effectiveStartDate: z.string().datetime("Invalid effective start date format"),
        effectiveEndDate: z.string().datetime().nullable().optional()
      })).min(1, "File must contain at least one schedule");

      const validationResult = scheduleImportSchema.safeParse(data);

      // Additional validation for date relationships
      if (validationResult.success) {
        for (const schedule of validationResult.data) {
          const departure = new Date(schedule.scheduledDeparture);
          const arrival = new Date(schedule.scheduledArrival);
          const startDate = new Date(schedule.effectiveStartDate);
          const endDate = schedule.effectiveEndDate ? new Date(schedule.effectiveEndDate) : null;

          if (arrival <= departure) {
            throw new Error("Arrival time must be after departure time");
          }

          if (endDate && endDate <= startDate) {
            throw new Error("Effective end date must be after start date");
          }
        }
      }

      if (!validationResult.success) {
        throw new Error(
          "Invalid schedule data format:\n" +
          validationResult.error.errors.map(err => 
            `${err.path.join('.')}: ${err.message}`
          ).join('\n')
        );
      }

      const response = await fetch('/api/schedules/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validationResult.data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import schedules');
      }

      const result = await response.json();
      
      toast({
        title: "Import successful",
        description: `Successfully imported ${result.summary.successful} schedules`
      });

      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import schedules",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isUploading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-center">Importing schedules...</p>
          </div>
        </div>
      )}
      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="hidden"
        id="json-upload"
        disabled={isUploading}
      />
      <label htmlFor="json-upload">
        <Button asChild disabled={isUploading}>
          <span>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "Importing..." : "Import Schedules"}
          </span>
        </Button>
      </label>
    </div>
  );
}
