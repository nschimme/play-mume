/*!
 * DecafMUD v0.9.0 - Modernized TypeScript
 * Draggable Elements Helper
 */

export class Position {
  public X: number;
  public Y: number;

  constructor(x: number, y: number) {
    this.X = x;
    this.Y = y;
  }

  public Add(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val !== null) {
      if (!isNaN(val.X)) newPos.X += val.X;
      if (!isNaN(val.Y)) newPos.Y += val.Y;
    }
    return newPos;
  }

  public Subtract(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val !== null) {
      if (!isNaN(val.X)) newPos.X -= val.X;
      if (!isNaN(val.Y)) newPos.Y -= val.Y;
    }
    return newPos;
  }

  public Min(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val === null) return newPos;
    if (!isNaN(val.X) && this.X > val.X) newPos.X = val.X;
    if (!isNaN(val.Y) && this.Y > val.Y) newPos.Y = val.Y;
    return newPos;
  }

  public Max(val: Position | null): Position {
    const newPos = new Position(this.X, this.Y);
    if (val === null) return newPos;
    if (!isNaN(val.X) && this.X < val.X) newPos.X = val.X;
    if (!isNaN(val.Y) && this.Y < val.Y) newPos.Y = val.Y;
    return newPos;
  }

  public Bound(lower: Position | null, upper: Position | null): Position {
    const newPos = this.Max(lower);
    return newPos.Min(upper);
  }

  public Check(): Position {
    return new Position(isNaN(this.X) ? 0 : this.X, isNaN(this.Y) ? 0 : this.Y);
  }

  public Apply(element: HTMLElement | string | null): void {
    const el = typeof element === 'string' ? document.getElementById(element) : element;
    if (!el) return;
    if (!isNaN(this.X)) el.style.left = `${this.X}px`;
    if (!isNaN(this.Y)) el.style.top = `${this.Y}px`;
  }
}

export function absoluteCursorPosition(eventObj: MouseEvent): Position {
  if (isNaN(window.scrollX)) {
    return new Position(
      eventObj.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft),
      eventObj.clientY + (document.documentElement.scrollTop || document.body.scrollTop)
    );
  }
  return new Position(eventObj.clientX + window.scrollX, eventObj.clientY + window.scrollY);
}

export class DragObject {
  private element: HTMLElement | null;
  private attachElement: HTMLElement | null;
  private lowerBound: Position | null;
  private upperBound: Position | null;
  private cursorStartPos: Position | null = null;
  private elementStartPos: Position | null = null;
  private dragging = false;
  private listening = false;
  private disposed = false;

  private onMouseMoveHandler = (e: Event) => this.dragGo(e as MouseEvent);
  private onMouseUpHandler = (e: Event) => this.dragStopHook(e as MouseEvent);
  private onMouseDownHandler = (e: Event) => this.dragStart(e as MouseEvent);

  constructor(
    element: HTMLElement | string,
    attachElement?: HTMLElement | string | null,
    lowerBound?: Position | null,
    upperBound?: Position | null
  ) {
    this.element = typeof element === 'string' ? document.getElementById(element) : element;
    this.attachElement = typeof attachElement === 'string' ? document.getElementById(attachElement) : (attachElement || this.element);
    this.lowerBound = lowerBound || null;
    this.upperBound = upperBound || null;

    if (this.attachElement) {
      this.StartListening();
    }
  }

  private dragStart(eventObj: MouseEvent): void {
    if (this.dragging || !this.listening || this.disposed || !this.element) return;
    this.dragging = true;

    this.cursorStartPos = absoluteCursorPosition(eventObj);
    this.elementStartPos = new Position(parseInt(this.element.style.left, 10), parseInt(this.element.style.top, 10)).Check();

    document.addEventListener('mousemove', this.onMouseMoveHandler);
    document.addEventListener('mouseup', this.onMouseUpHandler);

    eventObj.preventDefault();
    eventObj.stopPropagation();
  }

  private dragGo(eventObj: MouseEvent): void {
    if (!this.dragging || this.disposed || !this.element) return;

    let newPos = absoluteCursorPosition(eventObj);
    newPos = newPos.Add(this.elementStartPos).Subtract(this.cursorStartPos);
    newPos = newPos.Bound(this.lowerBound, this.upperBound);
    newPos.Apply(this.element);

    eventObj.preventDefault();
    eventObj.stopPropagation();
  }

  private dragStopHook(eventObj: MouseEvent): void {
    this.dragStop();
    eventObj.preventDefault();
    eventObj.stopPropagation();
  }

  private dragStop(): void {
    if (!this.dragging || this.disposed) return;
    document.removeEventListener('mousemove', this.onMouseMoveHandler);
    document.removeEventListener('mouseup', this.onMouseUpHandler);
    this.cursorStartPos = null;
    this.elementStartPos = null;
    this.dragging = false;
  }

  public Dispose(): void {
    if (this.disposed) return;
    this.StopListening(true);
    this.element = null;
    this.attachElement = null;
    this.disposed = true;
  }

  public StartListening(): void {
    if (this.listening || this.disposed || !this.attachElement) return;
    this.listening = true;
    this.attachElement.addEventListener('mousedown', this.onMouseDownHandler);
  }

  public StopListening(stopCurrentDragging = false): void {
    if (!this.listening || this.disposed || !this.attachElement) return;
    this.attachElement.removeEventListener('mousedown', this.onMouseDownHandler);
    this.listening = false;
    if (stopCurrentDragging && this.dragging) {
      this.dragStop();
    }
  }

  public IsDragging(): boolean {
    return this.dragging;
  }
}
