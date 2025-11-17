import { readFileSync, watchFile, existsSync } from 'fs';
import { RFQEvent } from './types';
import { botConfig } from './config';

export function readAllEvents(): RFQEvent[] {
  if (!existsSync(botConfig.eventsFile)) {
    return [];
  }

  const content = readFileSync(botConfig.eventsFile, 'utf-8');
  const lines = content.trim().split('\n').filter((line) => line.length > 0);

  const events: RFQEvent[] = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line) as RFQEvent;
      if (event.type === 'RFQ_CREATED') {
        events.push(event);
      }
    } catch (error) {
      console.error('[WATCHER] Error parsing event line:', error);
    }
  }

  return events;
}

export function watchEventsFile(onNewEvent: (event: RFQEvent) => Promise<void>): void {
  let lastLineCount = 0;

  // Initialize with current line count
  if (existsSync(botConfig.eventsFile)) {
    const content = readFileSync(botConfig.eventsFile, 'utf-8');
    lastLineCount = content.trim().split('\n').filter((line) => line.length > 0).length;
  }

  console.log(`[WATCHER] Starting file watcher on ${botConfig.eventsFile}`);
  console.log(`[WATCHER] Current line count: ${lastLineCount}`);

  watchFile(botConfig.eventsFile, { interval: 1000 }, async () => {
    try {
      const content = readFileSync(botConfig.eventsFile, 'utf-8');
      const lines = content.trim().split('\n').filter((line) => line.length > 0);

      if (lines.length > lastLineCount) {
        const newLines = lines.slice(lastLineCount);
        console.log(`[WATCHER] Found ${newLines.length} new line(s)`);

        for (const line of newLines) {
          try {
            const event = JSON.parse(line) as RFQEvent;
            if (event.type === 'RFQ_CREATED') {
              await onNewEvent(event);
            }
          } catch (error) {
            console.error('[WATCHER] Error parsing new event:', error);
          }
        }

        lastLineCount = lines.length;
      }
    } catch (error) {
      console.error('[WATCHER] Error reading events file:', error);
    }
  });
}
