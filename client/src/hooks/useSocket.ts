import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Schedule } from '@db/schema';

const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 3000;

export function useSocket() {
  const socket = useRef<Socket>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    function connect() {
      socket.current = io({
        reconnection: true,
        reconnectionAttempts: RECONNECTION_ATTEMPTS,
        reconnectionDelay: RECONNECTION_DELAY,
      });

      socket.current.on('connect', () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        toast({
          title: "Connected to server",
          description: "Real-time updates are now active",
        });
      });

      socket.current.on('disconnect', () => {
        setIsConnected(false);
        toast({
          title: "Disconnected from server",
          description: "Attempting to reconnect...",
          variant: "destructive",
        });
      });

      socket.current.on('connect_error', () => {
        reconnectAttempts.current += 1;
        if (reconnectAttempts.current >= RECONNECTION_ATTEMPTS) {
          toast({
            title: "Connection failed",
            description: "Please refresh the page to try again",
            variant: "destructive",
          });
        }
      });

      // Listen for schedule updates
      socket.current.on('scheduleUpdated', (updatedSchedule: Schedule) => {
        // Optimistically update the cache
        queryClient.setQueryData(['schedules'], (oldData: Schedule[] | undefined) => {
          if (!oldData) return [updatedSchedule];
          return oldData.map(schedule => 
            schedule.id === updatedSchedule.id ? updatedSchedule : schedule
          );
        });
      });
    }

    connect();

    return () => {
      socket.current?.disconnect();
    };
  }, [queryClient, toast]);

  const updateSchedule = async (data: {
    id: number;
    status: string;
    actualDeparture?: string | null;
    actualArrival?: string | null;
  }) => {
    if (!isConnected) {
      toast({
        title: "Not connected",
        description: "Please wait for connection to be established",
        variant: "destructive",
      });
      return;
    }

    try {
      // Optimistically update the UI
      queryClient.setQueryData(['schedules'], (oldData: Schedule[] | undefined) => {
        if (!oldData) return;
        return oldData.map(schedule =>
          schedule.id === data.id
            ? { ...schedule, ...data }
            : schedule
        );
      });

      // Emit the update
      socket.current?.emit('updateSchedule', data);
    } catch (error) {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: "Update failed",
        description: "Failed to update train status",
        variant: "destructive",
      });
    }
  };

  return { updateSchedule, isConnected };
}
