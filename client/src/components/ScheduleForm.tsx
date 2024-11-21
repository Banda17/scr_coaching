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
      trainNumber: z.string().min(1, "Train number is required"),
      trainId: z.number().min(1, "Train selection is required"),
      departureLocationId: z.number().min(1, "Departure location is required"),
      arrivalLocationId: z.number().min(1, "Arrival location is required"),
      effectiveStartDate: z.date(),
      effectiveEndDate: z.date().nullable().optional(),
      scheduledDeparture: z.coerce.date(),
      scheduledArrival: z.coerce.date(),
      runningDays: z.array(z.boolean()).length(7).default(Array(7).fill(true)),
      status: z.enum(['scheduled', 'delayed', 'completed', 'cancelled']).default('scheduled'),
      isCancelled: z.boolean().default(false)
    })),
    defaultValues: {
      status: 'scheduled',
      isCancelled: false,
      runningDays: Array(7).fill(true),
      effectiveStartDate: new Date(),
      effectiveEndDate: null,
      scheduledDeparture: new Date(),
      scheduledArrival: new Date(),
      trainNumber: '',
      trainId: 1,
      departureLocationId: 1,
      arrivalLocationId: 1
    },
    mode: 'onChange'
  });
  form.register('effectiveStartDate', {
    required: 'Start date is required'
  });
  form.register('effectiveEndDate', {
    validate: (value) => {
      if (!value) return true;
      const startDate = form.getValues('effectiveStartDate');
      if (!startDate) return 'Start date is required';
      const endDate = value;
      if (endDate && endDate <= startDate) {
        return 'End date must be after start date';
      }
      return true;
    }
  });

  form.register('scheduledDeparture', {
    required: 'Departure time is required',
    setValueAs: (value: string) => value ? new Date(value) : null
  });

  form.register('scheduledArrival', {
    required: 'Arrival time is required',
    setValueAs: (value: string) => value ? new Date(value) : null
  });

  const mutation = useMutation({
    mutationFn: async (values: InsertSchedule) => {
      const formattedValues = {
        ...values,
        scheduledDeparture: values.scheduledDeparture instanceof Date ? values.scheduledDeparture : new Date(),
        scheduledArrival: values.scheduledArrival instanceof Date ? values.scheduledArrival : new Date(),
        effectiveStartDate: values.effectiveStartDate ? new Date(values.effectiveStartDate) : null,
        effectiveEndDate: values.effectiveEndDate ? new Date(values.effectiveEndDate) : null,
        runningDays: Array.isArray(values.runningDays) ? values.runningDays : [true, true, true, true, true, true, true]
      };

      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'credentials': 'include'
        },
        credentials: 'include',
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

  const onSubmit = async (data: InsertSchedule & { trainNumber: string }) => {
    try {
      if (!data.trainId || !data.departureLocationId || !data.arrivalLocationId) {
        throw new Error("Please select train and locations");
      }

      if (!data.scheduledDeparture || !data.scheduledArrival) {
        throw new Error("Please select departure and arrival times");
      }

      // Dates are already converted to Date objects by the form registration
      const scheduledDeparture = data.scheduledDeparture;
      const scheduledArrival = data.scheduledArrival;
      const effectiveStartDate = data.effectiveStartDate || new Date();
      const effectiveEndDate = data.effectiveEndDate;

      if (scheduledArrival <= scheduledDeparture) {
        throw new Error("Arrival time must be after departure time");
      }

      if (effectiveEndDate && effectiveEndDate <= effectiveStartDate) {
        throw new Error("End date must be after start date");
      }

      const formattedData = {
        ...data,
        scheduledDeparture,
        scheduledArrival,
        effectiveStartDate,
        effectiveEndDate,
        runningDays: data.runningDays || Array(7).fill(true)
      };

      await mutation.mutateAsync(formattedData);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create schedule",
        variant: "destructive"
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <SelectItem 
                  key={train.id} 
                  value={train.id.toString()}
                >
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
            {...form.register('scheduledDeparture')}
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
            {...form.register('scheduledArrival')}
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
              setValueAs: (value: string) => value ? new Date(value) : new Date(),
              required: 'Start date is required'
            })}
            defaultValue={format(new Date(), 'yyyy-MM-dd')}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
              form.formState.errors.effectiveStartDate && "border-red-500"
            )}
          />
          {form.formState.errors.effectiveStartDate && (
            <span className="text-sm text-red-500">
              {form.formState.errors.effectiveStartDate.message}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label>Effective End Date (Optional)</label>
          <Input
            type="date"
            {...form.register('effectiveEndDate', {
              setValueAs: (value: string) => value ? new Date(value) : null,
              validate: (value) => {
                if (!value) return true;
                const startDate = form.getValues('effectiveStartDate');
                if (!startDate) return 'Start date is required';
                const endDate = new Date(value);
                if (endDate <= startDate) {
                  return 'End date must be after start date';
                }
                return true;
              }
            })}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
              form.formState.errors.effectiveEndDate && "border-red-500"
            )}
          />
          {form.formState.errors.effectiveEndDate && (
            <span className="text-sm text-red-500">
              {form.formState.errors.effectiveEndDate.message}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 mt-4">
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
                  form.setValue('runningDays', runningDays, { shouldValidate: true });
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