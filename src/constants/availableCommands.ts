interface Command {
  command: string;
  description: string;
}
const availableCommands: Command[] = [
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show help message" },
  { command: "result", description: "Fetch your exam results" },
  { command: "notifications", description: "Fetch latest KTU notifications" },
  { command: "cancel", description: "Cancel any ongoing operation" },
  { command: "subscribe", description: "Subscribe to notifications" },
  { command: "unsubscribe", description: "Unsubscribe from notifications" },
];

export default availableCommands;
