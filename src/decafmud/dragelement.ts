// SPDX-License-Identifier: MIT
/* code stolen from http://www.switchonthecode.com/tutorials/javascript-draggable-elements */

function hookEvent(element: EventTarget | string, eventName: string, callback: EventListener): void {
  let targetElement: EventTarget | null = null;
  if (typeof element === "string") {
    targetElement = document.getElementById(element);
  } else {
    targetElement = element;
  }

  if (targetElement === null) {
    return;
  }

  if (targetElement.addEventListener) {
    targetElement.addEventListener(eventName, callback, false);
  } else if ((targetElement as any).attachEvent) { // For older IE
    (targetElement as any).attachEvent("on" + eventName, callback);
  }
}

function unhookEvent(element: EventTarget | string, eventName: string, callback: EventListener): void {
  let targetElement: EventTarget | null = null;
  if (typeof element === "string") {
    targetElement = document.getElementById(element);
  } else {
    targetElement = element;
  }

  if (targetElement === null) {
    return;
  }

  if (targetElement.removeEventListener) {
    targetElement.removeEventListener(eventName, callback, false);
  } else if ((targetElement as any).detachEvent) { // For older IE
    (targetElement as any).detachEvent("on" + eventName, callback);
  }
}

function cancelEvent(e: Event): boolean {
  // The original code had `e = e ? e : window.event;` which is for very old IE.
  // Modern TypeScript with DOM types usually provides `e` directly.
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  if (e.preventDefault) {
    e.preventDefault();
  }
  (e as any).cancelBubble = true; // Older IE
  (e as any).returnValue = false; // Older IE
  return false;
}

class Position {
  public X: number;
  public Y: number;

  constructor(x: number, y: number) {
    this.X = x;
    this.Y = y;
  }

  public Add(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val !== null) {
      if (!isNaN(val.X)) {
        newPos.X += val.X;
      }
      if (!isNaN(val.Y)) {
        newPos.Y += val.Y;
      }
    }
    return newPos;
  }

  public Subtract(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val !== null) {
      if (!isNaN(val.X)) {
        newPos.X -= val.X;
      }
      if (!isNaN(val.Y)) {
        newPos.Y -= val.Y;
      }
    }
    return newPos;
  }

  public Min(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val === null) {
      return newPos;
    }

    if (!isNaN(val.X) && this.X > val.X) {
      newPos.X = val.X;
    }
    if (!isNaN(val.Y) && this.Y > val.Y) {
      newPos.Y = val.Y;
    }
    return newPos;
  }

  public Max(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val === null) {
      return newPos;
    }

    if (!isNaN(val.X) && this.X < val.X) {
      newPos.X = val.X;
    }
    if (!isNaN(val.Y) && this.Y < val.Y) {
      newPos.Y = val.Y;
    }
    return newPos;
  }

  public Bound(lower: Position | null, upper: Position | null): Position {
    let newPos = this.Max(lower);
    newPos = newPos.Min(upper); // Corrected: was this.Min(upper) which is not what Bound should do
    return newPos;
  }

  public Check(): Position {
    const newPos = new Position(this.X, this.Y);
    if (isNaN(newPos.X)) {
      newPos.X = 0;
    }
    if (isNaN(newPos.Y)) {
      newPos.Y = 0;
    }
    return newPos;
  }

  public Apply(element: HTMLElement | string | null): void {
    let targetElement: HTMLElement | null = null;
    if (typeof element === "string") {
      targetElement = document.getElementById(element);
    } else {
      targetElement = element;
    }

    if (targetElement === null) {
      return;
    }
    if (!isNaN(this.X)) {
      targetElement.style.left = this.X + 'px';
    }
    if (!isNaN(this.Y)) {
      targetElement.style.top = this.Y + 'px';
    }
  }
}

function absoluteCursorPostion(eventObj: MouseEvent): Position {
  // Modern browsers provide scrollX/scrollY directly on window.
  // The check for isNaN(window.scrollX) is likely for very old browsers.
  // document.documentElement.scrollLeft/Top and document.body.scrollLeft/Top
  // are for older IE compatibility.
  const scrollX = window.scrollX ?? (document.documentElement || document.body).scrollLeft;
  const scrollY = window.scrollY ?? (document.documentElement || document.body).scrollTop;
  return new Position(eventObj.clientX + scrollX, eventObj.clientY + scrollY);
}

class dragObject {
  private element: HTMLElement;
  private attachElement: HTMLElement;
  private lowerBound: Position | null;
  private upperBound: Position | null;
  private startCallback: ((event: MouseEvent, el: HTMLElement) => void) | null;
  private moveCallback: ((pos: Position, el: HTMLElement) => void) | null;
  private endCallback: ((el: HTMLElement) => void) | null;

  private cursorStartPos: Position | null = null;
  private elementStartPos: Position | null = null;
  private dragging: boolean = false;
  private listening: boolean = false;
  private disposed: boolean = false;

  constructor(
    element: HTMLElement | string,
    attachElement?: HTMLElement | string | null,
    lowerBound?: Position | null,
    upperBound?: Position | null,
    startCallback?: (event: MouseEvent, el: HTMLElement) => void,
    moveCallback?: (pos: Position, el: HTMLElement) => void,
    endCallback?: (el: HTMLElement) => void,
    attachLater?: boolean
  ) {
    let htmlElement: HTMLElement | null;
    if (typeof element === "string") {
      htmlElement = document.getElementById(element);
    } else {
      htmlElement = element;
    }
    if (htmlElement === null) {
      throw new Error("Draggable element not found or is null.");
    }
    this.element = htmlElement;

    if (lowerBound != null && upperBound != null) {
      const temp = lowerBound.Min(upperBound);
      this.upperBound = lowerBound.Max(upperBound); // upperBound should be the greater values
      this.lowerBound = temp; // lowerBound should be the lesser values
    } else {
      this.lowerBound = lowerBound ?? null;
      this.upperBound = upperBound ?? null;
    }

    this.startCallback = startCallback ?? null;
    this.moveCallback = moveCallback ?? null;
    this.endCallback = endCallback ?? null;

    let attachElResolved: HTMLElement | null;
    if (typeof attachElement === "string") {
        attachElResolved = document.getElementById(attachElement);
    } else {
        attachElResolved = attachElement ?? this.element;
    }
    if (attachElResolved === null) { // Should not happen if default is this.element
        this.attachElement = this.element;
    } else {
        this.attachElement = attachElResolved;
    }


    if (!attachLater) {
      this.StartListening();
    }
  }

  private dragStart = (eventObj: MouseEvent): boolean => {
    if (this.dragging || !this.listening || this.disposed) return true; // Return true if not handling
    this.dragging = true;

    if (this.startCallback !== null) {
      this.startCallback(eventObj, this.element);
    }

    this.cursorStartPos = absoluteCursorPostion(eventObj);
    this.elementStartPos = new Position(parseInt(this.element.style.left || "0"), parseInt(this.element.style.top || "0"));
    this.elementStartPos = this.elementStartPos.Check();

    hookEvent(document, "mousemove", this.dragGo as EventListener);
    hookEvent(document, "mouseup", this.dragStopHook as EventListener);

    return cancelEvent(eventObj);
  }

  private dragGo = (eventObj: MouseEvent): boolean => {
    if (!this.dragging || this.disposed) return true;

    if (!this.elementStartPos || !this.cursorStartPos) return true; // Should not happen if dragging

    let newPos = absoluteCursorPostion(eventObj);
    newPos = newPos.Add(this.elementStartPos).Subtract(this.cursorStartPos);
    newPos = newPos.Bound(this.lowerBound, this.upperBound);
    newPos.Apply(this.element);

    if (this.moveCallback !== null) {
      this.moveCallback(newPos, this.element);
    }

    return cancelEvent(eventObj);
  }

  private dragStopHook = (eventObj: MouseEvent): boolean => {
    this.dragStop();
    return cancelEvent(eventObj);
  }

  private dragStop = (): void => {
    if (!this.dragging || this.disposed) return;
    unhookEvent(document, "mousemove", this.dragGo as EventListener);
    unhookEvent(document, "mouseup", this.dragStopHook as EventListener);
    this.cursorStartPos = null;
    this.elementStartPos = null;
    if (this.endCallback !== null) {
      this.endCallback(this.element);
    }
    this.dragging = false;
  }

  public Dispose = (): void => {
    if (this.disposed) return;
    this.StopListening(true);
    // Nullify properties to help garbage collection, though TypeScript might not require explicit nulling as much
    // this.element = null; // Cannot assign to 'element' because it is a read-only property.
    // this.attachElement = null;
    this.lowerBound = null;
    this.upperBound = null;
    this.startCallback = null;
    this.moveCallback = null;
    this.endCallback = null;
    this.disposed = true;
  }

  public StartListening = (): void => {
    if (this.listening || this.disposed) return;
    this.listening = true;
    hookEvent(this.attachElement, "mousedown", this.dragStart as EventListener);
  }

  public StopListening = (stopCurrentDragging: boolean): void => {
    if (!this.listening || this.disposed) return;
    unhookEvent(this.attachElement, "mousedown", this.dragStart as EventListener);
    this.listening = false;

    if (stopCurrentDragging && this.dragging) {
      this.dragStop();
    }
  }

  public IsDragging = (): boolean => { return this.dragging; }
  public IsListening = (): boolean => { return this.listening; }
  public IsDisposed = (): boolean => { return this.disposed; }
}

// Make dragObject globally available if it's used by other JS files that expect it on window
(window as any).dragObject = dragObject;
(window as any).Position = Position; // Also expose Position if it's used externally
