import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import type { Schedule } from '@db/schema';

export function useSocket() {
  const socket = useRef<Socket>();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Connect to WebSocket server
    socket.current = io();

    // Listen for schedule updates
    socket.current.on('scheduleUpdated', (updatedSchedule: Schedule) => {
      // Update the schedules in the cache
      queryClient.setQueryData(['schedules'], (oldData: Schedule[] | undefined) => {
        if (!oldData) return [updatedSchedule];
        return oldData.map(schedule => 
          schedule.id === updatedSchedule.id ? updatedSchedule : schedule
        );
      });
    });

    return () => {
      socket.current?.disconnect();
    };
  }, [queryClient]);

  const updateSchedule = (data: {
    id: number;
    status: string;
    actualDeparture?: string | null;
    actualArrival?: string | null;
  }) => {
    socket.current?.emit('updateSchedule', data);
  };

  return { updateSchedule };
}
