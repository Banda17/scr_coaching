import { useForm } from "react-hook-form";
import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { insertScheduleSchema, type InsertSchedule, TrainType } from "@db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";
import type { Train, Location } from "@db/schema";

interface ScheduleFormProps {
  trains: Train[];
  locations: Location[];
}

interface ExtraLocation {
  locationId: number;
  arrivalTime: string;
  departureTime: string;
  remarks: string;
}

interface ImportantStation {
  locationId: number;
  arrivalTime: string;
  departureTime: string;
}

const importantStationSchema = z.object({
  locationId: z.number(),
  arrivalTime: z.string(),
  departureTime: z.string()
}).array().default([]);

const extraLocationSchema = z.object({
  locationId: z.number(),
  arrivalTime: z.string(),
  departureTime: z.string()
}).array().default([]);

const scheduleSchema = insertScheduleSchema.extend({
  extraLocations: extraLocationSchema,
  trainNumber: z.string().min(1, "Train number is required"),
  trainId: z.number().min(1, "Train selection is required"),
  departureLocationId: z.number().min(1, "Departure location is required"),
  arrivalLocationId: z.number().min(1, "Arrival location is required"),
  effectiveStartDate: z.coerce.date(),
  effectiveEndDate: z.coerce.date().nullable().optional(),
  scheduledDeparture: z.coerce.date(),
  scheduledArrival: z.coerce.date(),
  runningDays: z.array(z.boolean()).length(7).default(Array(7).fill(true)),
  status: z.enum(['scheduled', 'delayed', 'completed', 'cancelled']).default('scheduled'),
  isCancelled: z.boolean().default(false),
  importantStations: importantStationSchema,
  attachLocationId: z.number().nullable().optional(),
  attachTrainNumber: z.string().min(1, "Attach train number is required").optional(),
  attachTime: z.coerce.date().nullable().optional()
}).refine((data) => {
  if (data.attachTime && data.scheduledDeparture && data.scheduledArrival) {
    return new Date(data.attachTime) >= new Date(data.scheduledDeparture) && 
           new Date(data.attachTime) <= new Date(data.scheduledArrival);
  }
  return true;
}, {
  message: "Attach time must be between departure and arrival times",
  path: ["attachTime"]
});

type FormData = z.infer<typeof scheduleSchema>;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

export default function ScheduleForm({ trains, locations }: ScheduleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [importantStations, setImportantStations] = useState<ImportantStation[]>([]);
  const [showSpecialFields, setShowSpecialFields] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      status: 'scheduled',
      isCancelled: false,
      runningDays: Array(7).fill(true),
      importantStations: [],
      trainId: undefined,
      trainNumber: '',
      effectiveStartDate: new Date(),
      effectiveEndDate: null,
      departureLocationId: undefined,
      arrivalLocationId: undefined
    }
  });

  // Debug logging and validation for trains data
  useEffect(() => {
    console.log('ScheduleForm - Trains data:', {
      count: trains?.length || 0,
      sample: trains?.[0]
    });

    if (!Array.isArray(trains) || trains.length === 0) {
      console.error('ScheduleForm - Invalid or empty trains data');
      toast({
        title: "Error",
        description: "No trains available. Please add trains first.",
        variant: "destructive"
      });
    }
  }, [trains, toast]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Validate attach/detach times for special trains
      if (selectedTrain?.type === 'saloon' || selectedTrain?.type === 'ftr') {
        if (data.attachTime && data.attachLocationId && !data.attachTrainNumber) {
          throw new Error('Attach train number is required when specifying attach location and time');
        }
        if (data.attachTrainNumber && !data.attachLocationId) {
          throw new Error('Attach location is required when specifying attach train number');
        }
      }

      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          // Only include attach/detach fields for special trains
          ...(selectedTrain?.type === 'saloon' || selectedTrain?.type === 'ftr' ? {
            attachLocationId: data.attachLocationId || null,
            attachTrainNumber: data.attachTrainNumber || null,
            attachTime: data.attachTime || null,
            attachStatus: data.attachTrainNumber ? 'pending' : null
          } : {
            attachLocationId: null,
            attachTrainNumber: null,
            attachTime: null,
            attachStatus: null
          })
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create schedule');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: "Schedule created",
        description: "The schedule has been created successfully."
      });
      form.reset();
      setImportantStations([]);
      setShowSpecialFields(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create schedule",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = form.handleSubmit((data) => mutation.mutate(data));

  // Check if trains data is valid
  if (!Array.isArray(trains)) {
    console.error('Invalid trains data provided');
    return <div>Error: Invalid trains data</div>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label>Train</label>
          <Select
            onValueChange={(value) => {
              if (!value) return;
              
              const selectedId = parseInt(value, 10);
              const train = trains?.find(t => t.id === selectedId);
              
              if (!train) {
                console.error('Selected train not found:', selectedId);
                toast({
                  title: "Error",
                  description: "Selected train not found",
                  variant: "destructive"
                });
                return;
              }

              setSelectedTrain(train);
              setShowSpecialFields(train.type === 'saloon' || train.type === 'ftr');
              form.setValue('trainId', selectedId);
              form.setValue('trainNumber', train.trainNumber);
              
              console.log('Selected train:', {
                id: train.id,
                number: train.trainNumber,
                type: train.type
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select train" />
            </SelectTrigger>
            <SelectContent>
              {trains.map((train) => (
                <SelectItem key={train.id} value={train.id.toString()}>
                  {train.trainNumber} ({train.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label>Departure Location</label>
          <Select
            onValueChange={(value) => form.setValue('departureLocationId', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select departure location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id.toString()}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label>Arrival Location</label>
          <Select
            onValueChange={(value) => form.setValue('arrivalLocationId', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select arrival location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id.toString()}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label>Scheduled Departure</label>
          <Input
            type="datetime-local"
            {...form.register('scheduledDeparture')}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
              form.formState.errors.scheduledDeparture && "border-red-500"
            )}
          />
        </div>

        <div className="space-y-2">
          <label>Scheduled Arrival</label>
          <Input
            type="datetime-local"
            {...form.register('scheduledArrival')}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
              form.formState.errors.scheduledArrival && "border-red-500"
            )}
          />
        </div>

        <div className="space-y-2">
          <label>Effective Start Date</label>
          <Input
            type="date"
            {...form.register('effectiveStartDate')}
            defaultValue={format(new Date(), 'yyyy-MM-dd')}
          />
        </div>

        <div className="space-y-2">
          <label>Effective End Date (Optional)</label>
          <Input
            type="date"
            {...form.register('effectiveEndDate')}
          />
        </div>
      </div>

      <div className="space-y-4">
        <label className="font-medium">Running Days</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day.value} className="flex items-center space-x-2">
              <Checkbox
                id={`day-${day.value}`}
                checked={form.watch('runningDays')?.[day.value] ?? true}
                onCheckedChange={(checked) => {
                  const runningDays = [...(form.getValues('runningDays') || Array(7).fill(true))];
                  runningDays[day.value] = checked === true;
                  form.setValue('runningDays', runningDays);
                }}
              />
              <label
                htmlFor={`day-${day.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {day.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {showSpecialFields && (
        <div className="space-y-4 border-t pt-4 mt-4">
          <h3 className="font-medium">Special Train Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label>Attach Location</label>
              <Select
                onValueChange={(value) => form.setValue('attachLocationId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select attach location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label>Attach Train Number</label>
              <Input
                type="text"
                {...form.register('attachTrainNumber')}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
                  form.formState.errors.attachTrainNumber && "border-red-500"
                )}
                placeholder="Enter train number to attach"
              />
              {form.formState.errors.attachTrainNumber && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.attachTrainNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label>Attach Time</label>
              <Input
                type="datetime-local"
                {...form.register('attachTime')}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
                  form.formState.errors.attachTime && "border-red-500"
                )}
              />
              {form.formState.errors.attachTime && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.attachTime.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating..." : "Create Schedule"}
      </Button>
    </form>
  );
}