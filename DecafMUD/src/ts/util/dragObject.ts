// Based on code from http://www.switchonthecode.com/tutorials/javascript-draggable-elements
// Heavily typed and modernized for TypeScript ES6 module structure.

export function hookEvent(element: HTMLElement | Window | Document | null | string, eventName: string, callback: (event: Event) => any): void {
    let el: HTMLElement | Window | Document | null; // Allow Document type
    if (typeof element === "string") {
        el = document.getElementById(element);
    } else {
        el = element;
    }

    if (!el) return;

    if (el.addEventListener) {
        el.addEventListener(eventName, callback, false);
    } else if ((el as any).attachEvent) { // For older IE
        (el as any).attachEvent("on" + eventName, callback);
    }
}

export function unhookEvent(element: HTMLElement | Window | Document | null | string, eventName: string, callback: (event: Event) => any): void {
    let el: HTMLElement | Window | Document | null; // Allow Document type
    if (typeof element === "string") {
        el = document.getElementById(element);
    } else {
        el = element;
    }

    if (!el) return;

    if (el.removeEventListener) {
        el.removeEventListener(eventName, callback, false);
    } else if ((el as any).detachEvent) { // For older IE
        (el as any).detachEvent("on" + eventName, callback);
    }
}

export function cancelEvent(e: Event): false {
    const event = e || window.event; // window.event for older IE
    if (event.stopPropagation) {
        event.stopPropagation();
    }
    if (event.preventDefault) {
        event.preventDefault();
    }
    (event as any).cancelBubble = true; // Older IE
    // event.cancel = true; // Not a standard property
    (event as any).returnValue = false; // Older IE
    return false;
}

export class Position {
    X: number;
    Y: number;

    constructor(x: number, y: number) {
        this.X = x;
        this.Y = y;
    }

    public Add(val: Position | null): Position {
        const newPos = new Position(this.X, this.Y);
        if (val) {
            if (!isNaN(val.X)) newPos.X += val.X;
            if (!isNaN(val.Y)) newPos.Y += val.Y;
        }
        return newPos;
    }

    public Subtract(val: Position | null): Position {
        const newPos = new Position(this.X, this.Y);
        if (val) {
            if (!isNaN(val.X)) newPos.X -= val.X;
            if (!isNaN(val.Y)) newPos.Y -= val.Y;
        }
        return newPos;
    }

    public Min(val: Position | null): Position {
        const newPos = new Position(this.X, this.Y);
        if (!val) return newPos;

        if (!isNaN(val.X) && this.X > val.X) newPos.X = val.X;
        if (!isNaN(val.Y) && this.Y > val.Y) newPos.Y = val.Y;

        return newPos;
    }

    public Max(val: Position | null): Position {
        const newPos = new Position(this.X, this.Y);
        if (!val) return newPos;

        if (!isNaN(val.X) && this.X < val.X) newPos.X = val.X;
        if (!isNaN(val.Y) && this.Y < val.Y) newPos.Y = val.Y;

        return newPos;
    }

    public Bound(lower: Position | null, upper: Position | null): Position {
        let newPos = this.Max(lower);
        newPos = newPos.Min(upper);
        return newPos;
    }

    public Check(): Position {
        const newPos = new Position(this.X, this.Y);
        if (isNaN(newPos.X)) newPos.X = 0;
        if (isNaN(newPos.Y)) newPos.Y = 0;
        return newPos;
    }

    public Apply(element: HTMLElement | null | string): void {
        let el: HTMLElement | null;
        if (typeof element === "string") {
            el = document.getElementById(element);
        } else {
            el = element;
        }
        if (!el) return;

        if (!isNaN(this.X)) el.style.left = this.X + 'px';
        if (!isNaN(this.Y)) el.style.top = this.Y + 'px';
    }
}

export function absoluteCursorPosition(eventObj: MouseEvent): Position {
    const e = eventObj || (window.event as MouseEvent); // window.event for older IE

    if (isNaN(window.scrollX)) { // Older IE
        return new Position(
            e.clientX + (document.documentElement?.scrollLeft || document.body?.scrollLeft || 0),
            e.clientY + (document.documentElement?.scrollTop || document.body?.scrollTop || 0)
        );
    } else {
        return new Position(e.clientX + window.scrollX, e.clientY + window.scrollY);
    }
}

export class DragObject {
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

    // Bound event handlers
    private boundDragStart: (event: Event) => false | void;
    private boundDragGo: (event: Event) => false | void;
    private boundDragStopHook: (event: Event) => false | void;

    constructor(
        element: HTMLElement | string,
        attachElement?: HTMLElement | string | null,
        lowerBound?: Position | null,
        upperBound?: Position | null,
        startCallback?: (event: MouseEvent, el: HTMLElement) => void,
        moveCallback?: (pos: Position, el: HTMLElement) => void,
        endCallback?: (el: HTMLElement) => void,
        attachLater: boolean = false
    ) {
        let elTarget: HTMLElement | null;
        if (typeof element === "string") {
            elTarget = document.getElementById(element);
        } else {
            elTarget = element;
        }
        if (!elTarget) throw new Error("Draggable element not found or null.");
        this.element = elTarget;

        if (lowerBound && upperBound) {
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

        let attachElTarget: HTMLElement | null;
        if (typeof attachElement === "string") {
            attachElTarget = document.getElementById(attachElement);
        } else {
            attachElTarget = attachElement || null;
        }
        this.attachElement = attachElTarget || this.element;

        // Bind methods to this instance
        this.boundDragStart = this.dragStart.bind(this) as (event: Event) => false | void;
        this.boundDragGo = this.dragGo.bind(this) as (event: Event) => false | void;
        this.boundDragStopHook = this.dragStopHook.bind(this) as (event: Event) => false | void;

        if (!attachLater) {
            this.StartListening();
        }
    }

    private dragStart(eventObj: MouseEvent): false | void {
        if (this.dragging || !this.listening || this.disposed) return;
        this.dragging = true;

        if (this.startCallback) {
            this.startCallback(eventObj, this.element);
        }

        this.cursorStartPos = absoluteCursorPosition(eventObj);
        this.elementStartPos = new Position(parseInt(this.element.style.left || "0"), parseInt(this.element.style.top || "0"));
        this.elementStartPos = this.elementStartPos.Check();

        hookEvent(document, "mousemove", this.boundDragGo);
        hookEvent(document, "mouseup", this.boundDragStopHook);

        return cancelEvent(eventObj);
    }

    private dragGo(eventObj: MouseEvent): false | void {
        if (!this.dragging || this.disposed) return;

        let newPos = absoluteCursorPosition(eventObj);
        if (this.elementStartPos && this.cursorStartPos) {
            newPos = newPos.Add(this.elementStartPos).Subtract(this.cursorStartPos);
        }
        newPos = newPos.Bound(this.lowerBound, this.upperBound);
        newPos.Apply(this.element);

        if (this.moveCallback) {
            this.moveCallback(newPos, this.element);
        }

        return cancelEvent(eventObj);
    }

    private dragStopHook(eventObj: MouseEvent): false | void {
        this.dragStop();
        return cancelEvent(eventObj);
    }

    private dragStop(): void {
        if (!this.dragging || this.disposed) return;
        unhookEvent(document, "mousemove", this.boundDragGo);
        unhookEvent(document, "mouseup", this.boundDragStopHook);
        this.cursorStartPos = null;
        this.elementStartPos = null;
        if (this.endCallback) {
            this.endCallback(this.element);
        }
        this.dragging = false;
    }

    public Dispose(): void {
        if (this.disposed) return;
        this.StopListening(true);
        // Nullify properties to help GC, though TS might complain if not declared as nullable initially
        // For simplicity, we'll rely on scope and GC.
        this.disposed = true;
    }

    public StartListening(): void {
        if (this.listening || this.disposed) return;
        this.listening = true;
        hookEvent(this.attachElement, "mousedown", this.boundDragStart);
    }

    public StopListening(stopCurrentDragging: boolean = false): void {
        if (!this.listening || this.disposed) return;
        unhookEvent(this.attachElement, "mousedown", this.boundDragStart);
        this.listening = false;

        if (stopCurrentDragging && this.dragging) {
            this.dragStop();
        }
    }

    public IsDragging = (): boolean => this.dragging;
    public IsListening = (): boolean => this.listening;
    public IsDisposed = (): boolean => this.disposed;
}
