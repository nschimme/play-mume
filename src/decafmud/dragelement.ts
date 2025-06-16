// SPDX-License-Identifier: MIT
/* code stolen from http://www.switchonthecode.com/tutorials/javascript-draggable-elements */

// Helper functions (module-local)
function hookEvent(element: HTMLElement | Document | string | null, eventName: string, callback: (event: Event) => void): void {
  let actualElement: HTMLElement | Document | null = null;
  if (typeof element === "string") {
    actualElement = document.getElementById(element);
  } else {
    actualElement = element;
  }

  if (actualElement == null) {
    return;
  }
  if (actualElement.addEventListener) {
    actualElement.addEventListener(eventName, callback, false);
  } else if ((actualElement as any).attachEvent) { // For older IE
    (actualElement as any).attachEvent("on" + eventName, callback);
  }
}

function unhookEvent(element: HTMLElement | Document | string | null, eventName: string, callback: (event: Event) => void): void {
  let actualElement: HTMLElement | Document | null = null;
  if (typeof element === "string") {
    actualElement = document.getElementById(element);
  } else {
    actualElement = element;
  }

  if (actualElement == null) {
    return;
  }
  if (actualElement.removeEventListener) {
    actualElement.removeEventListener(eventName, callback, false);
  } else if ((actualElement as any).detachEvent) { // For older IE
    (actualElement as any).detachEvent("on" + eventName, callback);
  }
}

function cancelEvent(e: Event): boolean {
  const event = e || window.event; // For older IE
  if (event.stopPropagation) {
    event.stopPropagation();
  }
  if (event.preventDefault) {
    event.preventDefault();
  }
  (event as any).cancelBubble = true; // For older IE
  (event as any).returnValue = false; // For older IE
  return false;
}

export class Position {
  X: number;
  Y: number;

  constructor(x: number, y: number) {
    this.X = x;
    this.Y = y;
  }

  Add(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val != null) {
      if (!isNaN(val.X)) { newPos.X += val.X; }
      if (!isNaN(val.Y)) { newPos.Y += val.Y; }
    }
    return newPos;
  }

  Subtract(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val != null) {
      if (!isNaN(val.X)) { newPos.X -= val.X; }
      if (!isNaN(val.Y)) { newPos.Y -= val.Y; }
    }
    return newPos;
  }

  Min(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val == null) { return newPos; }
    if (!isNaN(val.X) && this.X > val.X) { newPos.X = val.X; }
    if (!isNaN(val.Y) && this.Y > val.Y) { newPos.Y = val.Y; }
    return newPos;
  }

  Max(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val == null) { return newPos; }
    if (!isNaN(val.X) && this.X < val.X) { newPos.X = val.X; }
    if (!isNaN(val.Y) && this.Y < val.Y) { newPos.Y = val.Y; }
    return newPos;
  }

  Bound(lower: Position | null, upper: Position | null): Position {
    let current: Position = new Position(this.X, this.Y); // Start with a copy
    if (lower) {
      current = current.Max(lower); // Max returns a new Position, so reassign
    }
    if (upper) {
      current = current.Min(upper); // Min returns a new Position, so reassign
    }
    return current;
  }

  Check(): Position {
    const newPos = new Position(this.X, this.Y);
    if (isNaN(newPos.X)) { newPos.X = 0; }
    if (isNaN(newPos.Y)) { newPos.Y = 0; }
    return newPos;
  }

  Apply(elementRef: HTMLElement | string | null): void {
    let element: HTMLElement | null = null;
    if (typeof elementRef === "string") {
      element = document.getElementById(elementRef);
    } else {
      element = elementRef;
    }
    if (element == null) { return; }
    if (!isNaN(this.X)) { element.style.left = this.X + 'px'; }
    if (!isNaN(this.Y)) { element.style.top = this.Y + 'px'; }
  }
}

function absoluteCursorPostion(eventObj: MouseEvent): Position {
  const e = eventObj || window.event as MouseEvent; // For older IE

  if (isNaN(window.scrollX)) { // Older IE check
    return new Position(e.clientX + (document.documentElement?.scrollLeft || document.body.scrollLeft),
                        e.clientY + (document.documentElement?.scrollTop || document.body.scrollTop));
  } else {
    return new Position(e.clientX + window.scrollX, e.clientY + window.scrollY);
  }
}

export class DragObject {
  private resolvedElement: HTMLElement;
  private attachElement: HTMLElement;
  private lowerBound: Position | null;
  private upperBound: Position | null;
  private startCallback: Function | null;
  private moveCallback: Function | null;
  private endCallback: Function | null;

  private cursorStartPos: Position | null = null;
  private elementStartPos: Position | null = null;
  private dragging: boolean = false;
  private listening: boolean = false;
  private disposed: boolean = false;

  constructor(
    element: HTMLElement | string | null,
    attachElement?: HTMLElement | string | null,
    lowerBound?: Position | null,
    upperBound?: Position | null,
    startCallback?: Function | null,
    moveCallback?: Function | null,
    endCallback?: Function | null,
    attachLater?: boolean
  ) {
    const resElement = typeof element === "string" ? document.getElementById(element) : element;
    if (resElement == null) {
      // Or throw an error, depending on desired behavior for invalid element
      this.disposed = true; // Mark as disposed if element is invalid
      this.resolvedElement = document.createElement("div"); // Dummy to satisfy TS
      this.attachElement = document.createElement("div"); // Dummy
      this.lowerBound = null; this.upperBound = null; this.startCallback = null; this.moveCallback = null; this.endCallback = null;
      return;
    }
    this.resolvedElement = resElement;

    const resAttachElement = typeof attachElement === "string" ? document.getElementById(attachElement) : attachElement;
    this.attachElement = resAttachElement == null ? this.resolvedElement : resAttachElement;

    this.lowerBound = lowerBound || null;
    this.upperBound = upperBound || null;

    if (this.lowerBound != null && this.upperBound != null) {
      const temp = this.lowerBound.Min(this.upperBound);
      this.upperBound = this.lowerBound.Max(this.upperBound);
      this.lowerBound = temp;
    }

    this.startCallback = startCallback || null;
    this.moveCallback = moveCallback || null;
    this.endCallback = endCallback || null;

    if (!attachLater) {
      this.StartListening();
    }
  }

  private dragStart(eventObj: MouseEvent): boolean {
    if (this.dragging || !this.listening || this.disposed) { return true; } // Return true if not actually starting
    this.dragging = true;

    if (this.startCallback != null) {
      this.startCallback(eventObj, this.resolvedElement);
    }

    this.cursorStartPos = absoluteCursorPostion(eventObj);
    this.elementStartPos = new Position(parseInt(this.resolvedElement.style.left || "0", 10), parseInt(this.resolvedElement.style.top || "0", 10));
    this.elementStartPos = this.elementStartPos.Check();

    hookEvent(document, "mousemove", this.dragGo.bind(this) as EventListener);
    hookEvent(document, "mouseup", this.dragStopHook.bind(this) as EventListener);

    return cancelEvent(eventObj);
  }

  private dragGo(eventObj: MouseEvent): boolean {
    if (!this.dragging || this.disposed) { return true; }
    if (!this.elementStartPos || !this.cursorStartPos) return true;


    let newPos = absoluteCursorPostion(eventObj);
    newPos = newPos.Add(this.elementStartPos).Subtract(this.cursorStartPos);
    newPos = newPos.Bound(this.lowerBound, this.upperBound);
    newPos.Apply(this.resolvedElement);

    if (this.moveCallback != null) {
      this.moveCallback(newPos, this.resolvedElement);
    }

    return cancelEvent(eventObj);
  }

  private dragStopHook(eventObj: MouseEvent): boolean {
    this.dragStop();
    return cancelEvent(eventObj);
  }

  private dragStop(): void {
    if (!this.dragging || this.disposed) { return; }
    unhookEvent(document, "mousemove", this.dragGo.bind(this) as EventListener);
    unhookEvent(document, "mouseup", this.dragStopHook.bind(this) as EventListener);
    this.cursorStartPos = null;
    this.elementStartPos = null;
    if (this.endCallback != null) {
      this.endCallback(this.resolvedElement);
    }
    this.dragging = false;
  }

  Dispose(): void {
    if (this.disposed) { return; }
    this.StopListening(true);
    // Nullify DOM references if they might hold onto significant memory,
    // but this.resolvedElement and this.attachElement are constructor args
    // so their lifecycle is tied to this object anyway.
    this.lowerBound = null;
    this.upperBound = null;
    this.startCallback = null;
    this.moveCallback = null;
    this.endCallback = null;
    this.disposed = true;
  }

  StartListening(): void {
    if (this.listening || this.disposed) { return; }
    this.listening = true;
    hookEvent(this.attachElement, "mousedown", this.dragStart.bind(this) as EventListener);
  }

  StopListening(stopCurrentDragging?: boolean): void {
    if (!this.listening || this.disposed) { return; }
    unhookEvent(this.attachElement, "mousedown", this.dragStart.bind(this) as EventListener);
    this.listening = false;

    if (stopCurrentDragging && this.dragging) {
      this.dragStop();
    }
  }

  IsDragging(): boolean { return this.dragging; }
  IsListening(): boolean { return this.listening; }
  IsDisposed(): boolean { return this.disposed; }
}
