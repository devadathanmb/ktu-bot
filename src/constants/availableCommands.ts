import { Command } from "@/types/types";

const availableCommands: Command[] = [
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show help message" },
  { command: "result", description: "Fetch your exam results" },
  { command: "notifications", description: "Fetch latest KTU notifications" },
  { command: "calendar", description: "Fetch KTU academic calendars" },
  { command: "timetable", description: "Fetch KTU exam time tables" },
  { command: "search", description: "See how to search for KTU notifications" },
  { command: "cancel", description: "Cancel any ongoing operation" },
  { command: "subscribe", description: "Subscribe to notifications" },
  { command: "unsubscribe", description: "Unsubscribe from notifications" },
  {
    command: "changefilter",
    description: "Change the filter for notifications",
  },
  { command: "code", description: "Show the source code for the bot" },
];

export default availableCommands;
