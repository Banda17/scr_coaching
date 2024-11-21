import { useForm } from "react-hook-form";
import { useState } from 'react';
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
  // Train type specific fields
  shortRouteLocationId: z.number().optional(),
  remarks: z.string().optional(),
  takingOverTime: z.string().optional(),
  handingOverTime: z.string().optional(),
  importantStations: importantStationSchema
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
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [importantStations, setImportantStations] = useState<ImportantStation[]>([]);
  const [extraLocations, setExtraLocations] = useState<ExtraLocation[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      status: 'scheduled',
      isCancelled: false,
      runningDays: Array(7).fill(true),
      importantStations: []
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
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

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Extra Locations */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <label className="text-lg font-medium">Additional Locations</label>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const newLocation: ExtraLocation = {
                  locationId: 0,
                  arrivalTime: '',
                  departureTime: ''
                };
                setExtraLocations([...extraLocations, newLocation]);
                const currentLocations = form.getValues('extraLocations') || [];
                form.setValue('extraLocations', [...currentLocations, newLocation]);
              }}
            >
              + Add Location
            </Button>
          </div>
          
          {extraLocations.map((location, index) => (
            <div key={index} className="grid grid-cols-3 gap-4 items-center mb-4 p-4 border rounded-lg">
              <Select
                value={location.locationId.toString()}
                onValueChange={(value) => {
                  const newLocations = [...extraLocations];
                  newLocations[index] = {
                    ...newLocations[index],
                    locationId: parseInt(value)
                  };
                  setExtraLocations(newLocations);
                  form.setValue('extraLocations', newLocations);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                type="time"
                value={location.arrivalTime}
                onChange={(e) => {
                  const newLocations = [...extraLocations];
                  newLocations[index] = {
                    ...newLocations[index],
                    arrivalTime: e.target.value
                  };
                  setExtraLocations(newLocations);
                  form.setValue('extraLocations', newLocations);
                }}
                placeholder="Arrival Time"
              />
              
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={location.departureTime}
                  onChange={(e) => {
                    const newLocations = [...extraLocations];
                    newLocations[index] = {
                      ...newLocations[index],
                      departureTime: e.target.value
                    };
                    setExtraLocations(newLocations);
                    form.setValue('extraLocations', newLocations);
                  }}
                  placeholder="Departure Time"
                />
                
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    const newLocations = [...extraLocations];
                    newLocations.splice(index, 1);
                    setExtraLocations(newLocations);
                    form.setValue('extraLocations', newLocations);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <label>Train</label>
          <Select
            onValueChange={(value) => {
              const train = trains.find(t => t.id === parseInt(value));
              setSelectedTrain(train || null);
              form.setValue('trainId', parseInt(value));
              if (train) {
                form.setValue('trainNumber', train.trainNumber);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select train" />
            </SelectTrigger>
            <SelectContent>
              {trains.map((train) => (
                <SelectItem key={train.id} value={train.id.toString()}>
                  {train.trainNumber} ({train.type.toUpperCase()})
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

        {/* Train type specific fields */}
        {selectedTrain && (selectedTrain.type === TrainType.TRC || selectedTrain.type === TrainType.SALOON) && (
          <>
            <div className="space-y-2">
              <label>Short Route Location</label>
              <Select
                onValueChange={(value) => form.setValue('shortRouteLocationId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select short route location" />
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
              <label>Remarks</label>
              <Input
                {...form.register('remarks')}
                placeholder="Enter remarks"
              />
            </div>
          </>
        )}

        {selectedTrain && (selectedTrain.type === TrainType.SPIC || selectedTrain.type === TrainType.SPL) && (
          <>
            <div className="space-y-2">
              <label>Taking Over Time</label>
              <Input
                type="time"
                {...form.register('takingOverTime')}
              />
            </div>
            <div className="space-y-2">
              <label>Handing Over Time</label>
              <Input
                type="time"
                {...form.register('handingOverTime')}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label>Important Stations</label>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Select
                    onValueChange={(value) => {
                      const newStation: ImportantStation = {
                        locationId: parseInt(value),
                        arrivalTime: '',
                        departureTime: ''
                      };
                      setImportantStations([...importantStations, newStation]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add station" />
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

                {importantStations.map((station, index) => (
                  <div key={index} className="grid grid-cols-3 gap-4 items-center">
                    <span>{locations.find(l => l.id === station.locationId)?.name}</span>
                    <Input
                      type="time"
                      value={station.arrivalTime}
                      onChange={(e) => {
                        const newStations = [...importantStations];
                        newStations[index] = {
                          ...newStations[index],
                          arrivalTime: e.target.value
                        };
                        setImportantStations(newStations);
                        form.setValue('importantStations', newStations);
                      }}
                    />
                    <Input
                      type="time"
                      value={station.departureTime}
                      onChange={(e) => {
                        const newStations = [...importantStations];
                        newStations[index] = {
                          ...newStations[index],
                          departureTime: e.target.value
                        };
                        setImportantStations(newStations);
                        form.setValue('importantStations', newStations);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

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

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating..." : "Create Schedule"}
      </Button>
    </form>
  );
}