/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 */

export type EventHandler<T = unknown> = (data: T) => void;

export class EventEmitter {
  private events: Map<string, EventHandler[]> = new Map();

  public on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    const handlers = this.events.get(event)!;
    handlers.push(handler as EventHandler);

    return () => this.off(event, handler);
  }

  public off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.events.get(event);
    if (!handlers) return;
    const index = handlers.indexOf(handler as EventHandler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
    if (handlers.length === 0) {
      this.events.delete(event);
    }
  }

  public emit<T = unknown>(event: string, data?: T): void {
    const handlers = this.events.get(event);
    if (!handlers) return;
    const listeners = [...handlers];
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error(`Error in event listener for '${event}':`, err);
      }
    }
  }

  public removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}
