import { Command } from "types/types";

const availableCommands: Command[] = [
  { command: "start", description: "🚀 Get started!" },
  { command: "cancel", description: "❌ Cancel operation" },
  { command: "help", description: "🆘 Help me!" },
  { command: "result", description: "🔍 KTU result lookup" },
  { command: "notifications", description: "💬 KTU notifications lookup" },
  { command: "calendar", description: "📅 KTU academic calendar lookup" },
  { command: "timetable", description: "📰 KTU exam time table lookup" },
  { command: "subscribe", description: "🔔 Subscribe to notifications" },
  { command: "unsubscribe", description: "🔕 Unsubscribe from notifications" },
  {
    command: "changefilter",
    description: "🔧 Change notification filter",
  },
  {
    command: "page",
    description: "🦘 Quick jump to a page",
  },
  {
    command: "serverstatus",
    description: "📊 Check KTU server status",
  },

  {
    command: "search",
    description: "🧐 See how to search for KTU notifications",
  },
  { command: "code", description: "💻 Show bot source code" },
];

export default availableCommands;
