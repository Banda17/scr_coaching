import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { insertScheduleSchema, type InsertSchedule } from "@db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";

const DAYS_OF_WEEK = [
  { label: 'Monday', value: 0 },
  { label: 'Tuesday', value: 1 },
  { label: 'Wednesday', value: 2 },
  { label: 'Thursday', value: 3 },
  { label: 'Friday', value: 4 },
  { label: 'Saturday', value: 5 },
  { label: 'Sunday', value: 6 },
];

interface ScheduleFormProps {
  trains: Array<{ id: number; trainNumber: string }>;
  locations: Array<{ id: number; name: string }>;
}

export default function ScheduleForm({ trains, locations }: ScheduleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertSchedule & { trainNumber: string }>({
    resolver: zodResolver(insertScheduleSchema.extend({
      trainNumber: z.string().min(1, "Train number is required")
    })),
    defaultValues: {
      status: 'scheduled',
      isCancelled: false,
      runningDays: [true, true, true, true, true, true, true],
      effectiveStartDate: new Date(),
      effectiveEndDate: null,
      scheduledDeparture: new Date(),
      scheduledArrival: new Date(),
      trainNumber: '',
      trainId: undefined,
      departureLocationId: undefined,
      arrivalLocationId: undefined
    } as const,
    mode: 'onChange'
  });

  // Register date fields with proper conversion
  form.register('scheduledDeparture', {
    required: 'Departure time is required',
    setValueAs: (value: string) => value ? new Date(value) : new Date()
  });

  form.register('scheduledArrival', {
    required: 'Arrival time is required',
    setValueAs: (value: string) => value ? new Date(value) : new Date()
  });

  form.register('effectiveStartDate', {
    required: 'Start date is required',
    setValueAs: (value: string) => value ? new Date(value) : new Date()
  });

  form.register('effectiveEndDate', {
    setValueAs: (value: string | null) => value ? new Date(value) : null
  });

  const mutation = useMutation({
    mutationFn: async (values: InsertSchedule) => {
      const formattedValues = {
        ...values,
        scheduledDeparture: values.scheduledDeparture instanceof Date ? values.scheduledDeparture : new Date(),
        scheduledArrival: values.scheduledArrival instanceof Date ? values.scheduledArrival : new Date(),
        effectiveStartDate: values.effectiveStartDate instanceof Date ? values.effectiveStartDate : new Date(),
        effectiveEndDate: values.effectiveEndDate ? new Date(values.effectiveEndDate) : null,
        runningDays: Array.isArray(values.runningDays) ? values.runningDays : [true, true, true, true, true, true, true]
      };
      
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedValues)
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
        description: "New schedule has been created successfully"
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create schedule",
        variant: "destructive"
      });
    }
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label>Train Number</label>
          <Input
            {...form.register('trainNumber', {
              required: 'Train number is required'
            })}
            placeholder="Enter train number"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
              form.formState.errors.trainNumber && "border-red-500"
            )}
          />
          {form.formState.errors.trainNumber && (
            <span className="text-sm text-red-500">
              {form.formState.errors.trainNumber.message}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label>Train</label>
          <Select
            name="trainId"
            onValueChange={(value) => {
              form.setValue('trainId', parseInt(value));
              const selectedTrain = trains.find(t => t.id === parseInt(value));
              if (selectedTrain) {
                form.setValue('trainNumber', selectedTrain.trainNumber);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select train" />
            </SelectTrigger>
            <SelectContent>
              {trains.map((train) => (
                <SelectItem key={train.id} value={train.id.toString()}>
                  {train.trainNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label>Departure Location</label>
          <Select
            name="departureLocationId"
            onValueChange={(value) => form.setValue('departureLocationId', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select departure" />
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
            name="arrivalLocationId"
            onValueChange={(value) => form.setValue('arrivalLocationId', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select arrival" />
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
            {...form.register('scheduledDeparture', {
              setValueAs: (value: string) => value ? new Date(value) : new Date()
            })}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
              form.formState.errors.scheduledDeparture && "border-red-500"
            )}
          />
          {form.formState.errors.scheduledDeparture && (
            <span className="text-sm text-red-500">
              {form.formState.errors.scheduledDeparture.message}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label>Scheduled Arrival</label>
          <Input
            type="datetime-local"
            {...form.register('scheduledArrival', {
              required: 'Arrival time is required',
              validate: (value) => {
                if (!value) return 'Please select arrival time';
                const arrivalDate = new Date(value);
                if (isNaN(arrivalDate.getTime())) {
                  return 'Invalid date format';
                }
                const departureDate = new Date(form.getValues('scheduledDeparture'));
                if (arrivalDate <= departureDate) {
                  return 'Arrival time must be after departure time';
                }
                return true;
              },
              setValueAs: (value: string) => value ? new Date(value) : null
            })}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
              form.formState.errors.scheduledArrival && "border-red-500"
            )}
          />
          {form.formState.errors.scheduledArrival && (
            <span className="text-sm text-red-500">
              {form.formState.errors.scheduledArrival.message}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label>Effective Start Date</label>
          <Input
            type="date"
            {...form.register('effectiveStartDate', {
              required: 'Start date is required',
              valueAsDate: true,
              setValueAs: (value: string) => value ? new Date(value) : new Date()
            })}
            defaultValue={format(new Date(), 'yyyy-MM-dd')}
          />
        </div>

        <div className="space-y-2">
          <label>Effective End Date (Optional)</label>
          <Input
            type="date"
            {...form.register('effectiveEndDate', {
              valueAsDate: true,
              validate: (value) => {
                if (!value) return true;
                const startDate = form.getValues('effectiveStartDate');
                if (!startDate) return 'Start date is required';
                if (value <= startDate) {
                  return 'End date must be after start date';
                }
                return true;
              }
            })}
          />
        </div>
      </div>

      <div className="space-y-4 mt-4">
        <label className="font-medium">Running Days</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day.value} className="flex items-center space-x-2">
              <Checkbox
                id={`day-${day.value}`}
                checked={form.watch(`runningDays.${day.value}`)}
                onCheckedChange={(checked) => {
                  const currentRunningDays = form.getValues('runningDays') ?? [true, true, true, true, true, true, true];
                  const updatedDays = [...currentRunningDays];
                  updatedDays[day.value] = checked === true;
                  form.setValue('runningDays', updatedDays, { shouldValidate: true });
                }}
              />
              <label htmlFor={`day-${day.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {day.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full mt-6">
        Create Schedule
      </Button>
    </form>
  );
}
