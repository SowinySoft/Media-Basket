"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  content: string;
  connector_type: string;
  display_name: string;
  scheduled_at: string;
  status: string;
  published_at: string | null;
  media_urls: string[] | null;
}

interface Props {
  orgId: string;
}

const CONNECTOR_COLORS: Record<string, string> = {
  youtube: "bg-red-600",
  reddit: "bg-orange-600",
  whatsapp: "bg-green-600",
  telegram: "bg-blue-600",
  instagram: "bg-pink-600",
  twitter: "bg-sky-600",
  facebook: "bg-blue-700",
  linkedin: "bg-blue-800",
  tiktok: "bg-gray-800",
  discord: "bg-indigo-600",
  slack: "bg-purple-600",
  mastodon: "bg-violet-600",
  pinterest: "bg-red-700",
  snapchat: "bg-yellow-500",
  bluesky: "bg-sky-700",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarView({ orgId }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchCalendar();
  }, [orgId, year, month]);

  const fetchCalendar = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/calendar?year=${year}&month=${month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = () => new Date(year, month, 0).getDate();
  const getFirstDayOfMonth = () => new Date(year, month - 1, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      const d = new Date(e.scheduled_at);
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
    });
  };

  const daysInMonth = getDaysInMonth();
  const firstDay = getFirstDayOfMonth();
  const today = new Date();

  return (
    <div className="border border-gray-700 rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Content Calendar</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-white font-medium">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 text-gray-400 hover:text-white">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="p-4">
        {isLoading ? (
          <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-gray-700">
            {/* Day headers */}
            {DAYS.map((day) => (
              <div key={day} className="bg-gray-800 px-2 py-1 text-center text-xs text-gray-400 font-medium">
                {day}
              </div>
            ))}

            {/* Calendar cells */}
            {Array.from({ length: 42 }).map((_, i) => {
              const day = i - firstDay + 1;
              const isCurrentMonth = day >= 1 && day <= daysInMonth;
              const isToday =
                isCurrentMonth &&
                today.getFullYear() === year &&
                today.getMonth() + 1 === month &&
                today.getDate() === day;
              const dayEvents = isCurrentMonth ? getEventsForDay(day) : [];

              return (
                <div
                  key={i}
                  className={`bg-gray-800 min-h-[80px] p-1 ${
                    !isCurrentMonth ? "opacity-30" : ""
                  } ${isToday ? "ring-1 ring-blue-500" : ""}`}
                >
                  {isCurrentMonth && (
                    <>
                      <div className={`text-xs mb-1 ${isToday ? "text-blue-400 font-bold" : "text-gray-400"}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            className={`${
                              CONNECTOR_COLORS[event.connector_type] || "bg-gray-600"
                            } text-white text-[10px] px-1 py-0.5 rounded cursor-pointer truncate hover:opacity-80`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-400">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setSelectedEvent(null)}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-3">{selectedEvent.title}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Platform</span>
                <span className="text-white">{selectedEvent.display_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Scheduled</span>
                <span className="text-white">
                  {new Date(selectedEvent.scheduled_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  selectedEvent.status === "published"
                    ? "bg-green-600 text-white"
                    : selectedEvent.status === "failed"
                    ? "bg-red-600 text-white"
                    : "bg-yellow-600 text-white"
                }`}>
                  {selectedEvent.status}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Content</span>
                <p className="text-white text-sm mt-1">{selectedEvent.content}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="mt-4 w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
