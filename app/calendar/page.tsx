'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';

interface Event {
  id: string;
  title: string;
  date: Date;
  type: 'deadline' | 'renewal' | 'review';
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch('/api/calendar/events');
        const data = await response.json();
        setEvents(data.map((event: any) => ({
          ...event,
          date: new Date(event.date),
        })));
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    }

    fetchEvents();
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (date: Date) => {
    return events.filter(event => 
      format(event.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <div className="mt-4 flex space-x-3 md:mt-0">
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

      <div className="mt-10">
        <div className="text-center">
          <h2 className="font-semibold text-gray-900">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="mt-6 grid grid-cols-7 gap-px bg-gray-200 text-center text-xs leading-6 text-gray-700">
          <div className="bg-white py-2">Sun</div>
          <div className="bg-white py-2">Mon</div>
          <div className="bg-white py-2">Tue</div>
          <div className="bg-white py-2">Wed</div>
          <div className="bg-white py-2">Thu</div>
          <div className="bg-white py-2">Fri</div>
          <div className="bg-white py-2">Sat</div>
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            return (
              <div
                key={day.toString()}
                className={`min-h-[120px] bg-white px-3 py-2 ${
                  !isSameMonth(day, currentDate) ? 'bg-gray-50 text-gray-400' : ''
                } ${isToday(day) ? 'bg-yellow-50' : ''}`}
              >
                <time dateTime={format(day, 'yyyy-MM-dd')} className={`block text-sm ${
                  isToday(day) ? 'font-semibold text-indigo-600' : ''
                }`}>
                  {format(day, 'd')}
                </time>
                <div className="space-y-1 mt-2">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`text-xs p-1 rounded truncate ${
                        event.type === 'deadline' ? 'bg-red-100 text-red-800' :
                        event.type === 'renewal' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
