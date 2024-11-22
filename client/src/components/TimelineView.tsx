import { Calendar, Views, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

import type { Schedule as DbSchedule } from "@db/schema";

interface Schedule extends Omit<DbSchedule, 'scheduledDeparture' | 'scheduledArrival' | 'actualDeparture' | 'actualArrival'> {
  scheduledDeparture: Date | string;
  scheduledArrival: Date | string;
  actualDeparture: Date | string | null;
  actualArrival: Date | string | null;
}

interface TimelineViewProps {
  schedules: Schedule[];
}

export default function TimelineView({ schedules }: TimelineViewProps) {
  const events = schedules.flatMap(schedule => {
    // Get the current date's day of week (0 = Monday, 6 = Sunday)
    const currentDate = new Date();
    const currentDayOfWeek = (currentDate.getDay() + 6) % 7; // Convert Sunday = 0 to Sunday = 6
    
    // Check if schedule is effective
    const startDate = new Date(schedule.effectiveStartDate);
    const endDate = schedule.effectiveEndDate ? new Date(schedule.effectiveEndDate) : null;
    if (
      startDate > currentDate || 
      (endDate && endDate < currentDate) ||
      !schedule.runningDays[currentDayOfWeek]
    ) {
      return [];
    }

    return [{
      id: schedule.id,
      title: schedule.train?.trainNumber 
        ? `Train ${schedule.train.trainNumber} - ${schedule.train.type?.toUpperCase()}`
        : `Train ${schedule.trainId}`,
      start: schedule.scheduledDeparture instanceof Date 
        ? schedule.scheduledDeparture 
        : new Date(schedule.scheduledDeparture),
      end: schedule.scheduledArrival instanceof Date 
        ? schedule.scheduledArrival 
        : new Date(schedule.scheduledArrival),
      status: schedule.status,
      isCancelled: schedule.isCancelled,
      runningDays: schedule.runningDays,
    }];
  });

  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#22c55e'; // green for running
    if (event.status === 'delayed') backgroundColor = '#f59e0b';
    if (event.status === 'cancelled' || event.isCancelled) backgroundColor = '#ef4444';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        color: 'white',
        border: 'none',
        display: 'block'
      }
    };
  };

  return (
    <div className="h-[700px] max-w-full mx-auto bg-background rounded-lg shadow-sm border">
      <Calendar
        localizer={localizer}
        events={events}
        defaultView={Views.MONTH}
        views={['day', 'week', 'month']}
        step={15}
        timeslots={4}
        eventPropGetter={eventStyleGetter}
        formats={{
          monthHeaderFormat: 'MMMM YYYY',
          dayHeaderFormat: 'dddd, MMMM D',
          dayRangeHeaderFormat: ({ start, end }) => 
            `${moment(start).format('MMM D')} - ${moment(end).format('MMM D, YYYY')}`
        }}
        messages={{
          today: 'Today',
          next: 'Next',
          previous: 'Previous',
          month: 'Month',
          week: 'Week',
          day: 'Day'
        }}
      />
    </div>
  );
}
