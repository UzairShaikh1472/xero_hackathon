type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...meta
  };

  console.log(JSON.stringify(payload));
}

export const logger = {
  info(event: string, meta?: Record<string, unknown>) {
    write("info", event, meta);
  },
  warn(event: string, meta?: Record<string, unknown>) {
    write("warn", event, meta);
  },
  error(event: string, meta?: Record<string, unknown>) {
    write("error", event, meta);
  }
};
