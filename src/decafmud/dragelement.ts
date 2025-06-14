// SPDX-License-Identifier: GPL-3.0-or-later
/* code stolen from http://www.switchonthecode.com/tutorials/javascript-draggable-elements */

function hookEvent(
  element: HTMLElement | string | null,
  eventName: string,
  callback: (event: Event) => void
): void {
  if (typeof element === "string") {
    element = document.getElementById(element);
  }
  if (element == null) {
    return;
  }
  if (element.addEventListener) {
    element.addEventListener(eventName, callback, false);
  } else if ((element as any).attachEvent) {
    (element as any).attachEvent("on" + eventName, callback);
  }
}

function unhookEvent(
  element: HTMLElement | string | null,
  eventName: string,
  callback: (event: Event) => void
): void {
  if (typeof element == "string") {
    element = document.getElementById(element);
  }
  if (element == null) {
    return;
  }
  if (element.removeEventListener) {
    element.removeEventListener(eventName, callback, false);
  } else if ((element as any).detachEvent) {
    (element as any).detachEvent("on" + eventName, callback);
  }
}

function cancelEvent(e: Event): boolean {
  const event = e ? e : window.event;
  if (event.stopPropagation) {
    event.stopPropagation();
  }
  if (event.preventDefault) {
    event.preventDefault();
  }
  (event as any).cancelBubble = true;
  (event as any).cancel = true;
  (event as any).returnValue = false;
  return false;
}

interface IPosition {
  X: number;
  Y: number;
  Add(val: IPosition | null): IPosition;
  Subtract(val: IPosition | null): IPosition;
  Min(val: IPosition | null): IPosition;
  Max(val: IPosition | null): IPosition;
  Bound(lower: IPosition | null, upper: IPosition | null): IPosition;
  Check(): IPosition;
  Apply(element: HTMLElement | string | null): void;
}

class Position implements IPosition {
  public X: number;
  public Y: number;

  constructor(x: number, y: number) {
    this.X = x;
    this.Y = y;
  }

  public Add(val: IPosition | null): IPosition {
    const newPos = new Position(this.X, this.Y);
    if (val != null) {
      if (!isNaN(val.X)) newPos.X += val.X;
      if (!isNaN(val.Y)) newPos.Y += val.Y;
    }
    return newPos;
  }

  public Subtract(val: IPosition | null): IPosition {
    const newPos = new Position(this.X, this.Y);
    if (val != null) {
      if (!isNaN(val.X)) newPos.X -= val.X;
      if (!isNaN(val.Y)) newPos.Y -= val.Y;
    }
    return newPos;
  }

  public Min(val: IPosition | null): IPosition {
    const newPos = new Position(this.X, this.Y);
    if (val == null) return newPos;

    if (!isNaN(val.X) && this.X > val.X) newPos.X = val.X;
    if (!isNaN(val.Y) && this.Y > val.Y) newPos.Y = val.Y;

    return newPos;
  }

  public Max(val: IPosition | null): IPosition {
    const newPos = new Position(this.X, this.Y);
    if (val == null) return newPos;

    if (!isNaN(val.X) && this.X < val.X) newPos.X = val.X;
    if (!isNaN(val.Y) && this.Y < val.Y) newPos.Y = val.Y;

    return newPos;
  }

  public Bound(lower: IPosition | null, upper: IPosition | null): IPosition {
    const newPos = this.Max(lower);
    return newPos.Min(upper);
  }

  public Check(): IPosition {
    const newPos = new Position(this.X, this.Y);
    if (isNaN(newPos.X)) newPos.X = 0;
    if (isNaN(newPos.Y)) newPos.Y = 0;
    return newPos;
  }

  public Apply(element: HTMLElement | string | null): void {
    let targetElement: HTMLElement | null;
    if (typeof element === "string") {
      targetElement = document.getElementById(element);
    } else {
      targetElement = element;
    }

    if (targetElement == null) return;

    if (!isNaN(this.X)) targetElement.style.left = this.X + 'px';
    if (!isNaN(this.Y)) targetElement.style.top = this.Y + 'px';
  }
}

function absoluteCursorPostion(eventObj: MouseEvent): IPosition {
  const e = eventObj ? eventObj : (window.event as MouseEvent);

  if (isNaN(window.scrollX)) {
    return new Position(
      e.clientX + document.documentElement.scrollLeft + document.body.scrollLeft,
      e.clientY + document.documentElement.scrollTop + document.body.scrollTop
    );
  } else {
    return new Position(e.clientX + window.scrollX, e.clientY + window.scrollY);
  }
}

class DragObject {
  private element: HTMLElement;
  private attachElement: HTMLElement;
  private lowerBound: IPosition | null;
  private upperBound: IPosition | null;
  private startCallback: ((eventObj: MouseEvent, element: HTMLElement) => void) | null;
  private moveCallback: ((newPos: IPosition, element: HTMLElement) => void) | null;
  private endCallback: ((element: HTMLElement) => void) | null;

  private cursorStartPos: IPosition | null = null;
  private elementStartPos: IPosition | null = null;
  private dragging: boolean = false;
  private listening: boolean = false;
  private disposed: boolean = false;

  constructor(
    element: HTMLElement | string,
    attachElement?: HTMLElement | string | null,
    lowerBound?: IPosition | null,
    upperBound?: IPosition | null,
    startCallback?: (eventObj: MouseEvent, element: HTMLElement) => void,
    moveCallback?: (newPos: IPosition, element: HTMLElement) => void,
    endCallback?: (element: HTMLElement) => void,
    attachLater?: boolean
  ) {
    if (typeof element === "string") {
      this.element = document.getElementById(element) as HTMLElement;
    } else {
      this.element = element;
    }

    if (this.element == null) {
      throw new Error("Element to drag cannot be null");
    }

    if (lowerBound != null && upperBound != null) {
      const temp = lowerBound.Min(upperBound);
      this.upperBound = lowerBound.Max(upperBound);
      this.lowerBound = temp;
    } else {
      this.lowerBound = lowerBound || null;
      this.upperBound = upperBound || null;
    }

    this.startCallback = startCallback || null;
    this.moveCallback = moveCallback || null;
    this.endCallback = endCallback || null;

    if (typeof attachElement === "string") {
      this.attachElement = document.getElementById(attachElement) as HTMLElement;
    } else if (attachElement == null) {
      this.attachElement = this.element;
    } else {
      this.attachElement = attachElement;
    }

    if (!attachLater) {
      this.StartListening();
    }
  }

  private dragStart = (eventObj: MouseEvent): boolean => {
    if (this.dragging || !this.listening || this.disposed) return false; // Should not cancel event if not handling
    this.dragging = true;

    if (this.startCallback != null) {
      this.startCallback(eventObj, this.element);
    }

    this.cursorStartPos = absoluteCursorPostion(eventObj);
    this.elementStartPos = new Position(
      parseInt(this.element.style.left, 10),
      parseInt(this.element.style.top, 10)
    );
    this.elementStartPos = this.elementStartPos.Check();

    hookEvent(document, "mousemove", this.dragGo as (event: Event) => void);
    hookEvent(document, "mouseup", this.dragStopHook as (event: Event) => void);

    return cancelEvent(eventObj);
  }

  private dragGo = (eventObj: MouseEvent): boolean => {
    if (!this.dragging || this.disposed) return false;

    let newPos = absoluteCursorPostion(eventObj);
    if (this.elementStartPos && this.cursorStartPos) {
        newPos = newPos.Add(this.elementStartPos).Subtract(this.cursorStartPos);
    }
    newPos = newPos.Bound(this.lowerBound, this.upperBound);
    newPos.Apply(this.element);

    if (this.moveCallback != null) {
      this.moveCallback(newPos, this.element);
    }

    return cancelEvent(eventObj);
  }

  private dragStopHook = (eventObj: Event): boolean => {
    this.dragStop();
    return cancelEvent(eventObj);
  }

  private dragStop = (): void => {
    if (!this.dragging || this.disposed) return;
    unhookEvent(document, "mousemove", this.dragGo as (event: Event) => void);
    unhookEvent(document, "mouseup", this.dragStopHook as (event: Event) => void);
    this.cursorStartPos = null;
    this.elementStartPos = null;
    if (this.endCallback != null) {
      this.endCallback(this.element);
    }
    this.dragging = false;
  }

  public Dispose(): void {
    if (this.disposed) return;
    this.StopListening(true);
    // Nullify properties to help garbage collection and prevent memory leaks
    this.element = null!;
    this.attachElement = null!;
    this.lowerBound = null;
    this.upperBound = null;
    this.startCallback = null;
    this.moveCallback = null;
    this.endCallback = null;
    this.disposed = true;
  }

  public StartListening(): void {
    if (this.listening || this.disposed) return;
    this.listening = true;
    hookEvent(this.attachElement, "mousedown", this.dragStart as (event: Event) => void);
  }

  public StopListening(stopCurrentDragging?: boolean): void {
    if (!this.listening || this.disposed) return;
    unhookEvent(this.attachElement, "mousedown", this.dragStart as (event: Event) => void);
    this.listening = false;

    if (stopCurrentDragging && this.dragging) {
      this.dragStop();
    }
  }

  public IsDragging = (): boolean => { return this.dragging; }
  public IsListening = (): boolean => { return this.listening; }
  public IsDisposed = (): boolean => { return this.disposed; }
}
