// Based on code from http://www.switchonthecode.com/tutorials/javascript-draggable-elements
// Converted to TypeScript

// --- Helper Functions ---

function hookEvent(element: HTMLElement | Document, eventName: string, callback: (event: Event) => any): void {
    if (element.addEventListener) {
        element.addEventListener(eventName, callback, false);
    } else if ((element as any).attachEvent) { // For older IE
        (element as any).attachEvent("on" + eventName, callback);
    }
}

function unhookEvent(element: HTMLElement | Document, eventName: string, callback: (event: Event) => any): void {
    if (element.removeEventListener) {
        element.removeEventListener(eventName, callback, false);
    } else if ((element as any).detachEvent) { // For older IE
        (element as any).detachEvent("on" + eventName, callback);
    }
}

function cancelEvent(e: Event): false {
    const event = e || window.event; // window.event for older IE
    if (event.stopPropagation) {
        event.stopPropagation();
    }
    if (event.preventDefault) {
        event.preventDefault();
    }
    (event as any).cancelBubble = true; // IE
    // event.cancel = true; // This is not a standard property
    (event as any).returnValue = false; // IE
    return false;
}

// --- Position Class ---

export class Position {
    public X: number;
    public Y: number;

    constructor(x: number, y: number) {
        this.X = x;
        this.Y = y;
    }

    public Add(val: Position | null): Position {
        const newPos = new Position(this.X, this.Y);
        if (val != null) {
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
        if (val != null) {
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
        if (val == null) {
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
        if (val == null) {
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
        let newPos = this;
        if (lower) newPos = newPos.Max(lower);
        if (upper) newPos = newPos.Min(upper);
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

    public Apply(elementIdOrElement: string | HTMLElement | null): void {
        let element: HTMLElement | null;
        if (typeof elementIdOrElement === "string") {
            element = document.getElementById(elementIdOrElement);
        } else {
            element = elementIdOrElement;
        }

        if (element == null) {
            return;
        }
        if (!isNaN(this.X)) {
            element.style.left = this.X + 'px';
        }
        if (!isNaN(this.Y)) {
            element.style.top = this.Y + 'px';
        }
    }
}

function absoluteCursorPosition(eventObj: MouseEvent): Position {
    const e = eventObj || window.event as MouseEvent; // window.event for older IE

    if (isNaN(window.scrollX)) { // Older IE check
        return new Position(
            e.clientX + (document.documentElement?.scrollLeft || document.body.scrollLeft),
            e.clientY + (document.documentElement?.scrollTop || document.body.scrollTop)
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
    private boundDragStart: (event: MouseEvent) => false;
    private boundDragGo: (event: MouseEvent) => false;
    private boundDragStopHook: (event: MouseEvent) => false;

    constructor(
        elementIdOrElement: string | HTMLElement,
        attachElementIdOrElement?: string | HTMLElement | null,
        lowerBound?: Position | null,
        upperBound?: Position | null,
        startCallback?: (event: MouseEvent, el: HTMLElement) => void,
        moveCallback?: (pos: Position, el: HTMLElement) => void,
        endCallback?: (el: HTMLElement) => void,
        attachLater: boolean = false
    ) {
        let tempElement: HTMLElement | null;
        if (typeof elementIdOrElement === "string") {
            tempElement = document.getElementById(elementIdOrElement);
        } else {
            tempElement = elementIdOrElement;
        }

        if (tempElement == null) {
            throw new Error("Draggable element not found or is null.");
        }
        this.element = tempElement;

        if (lowerBound != null && upperBound != null) {
            const temp = lowerBound.Min(upperBound);
            this.upperBound = lowerBound.Max(upperBound); // Max of original values
            this.lowerBound = temp; // Min of original values
        } else {
            this.lowerBound = lowerBound || null;
            this.upperBound = upperBound || null;
        }

        this.startCallback = startCallback || null;
        this.moveCallback = moveCallback || null;
        this.endCallback = endCallback || null;

        let tempAttachElement: HTMLElement | null = null;
        if (typeof attachElementIdOrElement === "string") {
            tempAttachElement = document.getElementById(attachElementIdOrElement);
        } else if (attachElementIdOrElement instanceof HTMLElement) {
            tempAttachElement = attachElementIdOrElement;
        }
        this.attachElement = tempAttachElement || this.element;

        // Bind methods to this instance
        this.boundDragStart = this.dragStart.bind(this);
        this.boundDragGo = this.dragGo.bind(this);
        this.boundDragStopHook = this.dragStopHook.bind(this);

        if (!attachLater) {
            this.StartListening();
        }
    }

    private dragStart(eventObj: MouseEvent): false {
        if (this.dragging || !this.listening || this.disposed) return false; // Should not happen if called by event
        this.dragging = true;

        if (this.startCallback != null) {
            this.startCallback(eventObj, this.element);
        }

        this.cursorStartPos = absoluteCursorPosition(eventObj);

        // Ensure style is set for parsing - might need to getComputedStyle if not inline
        this.elementStartPos = new Position(
            parseInt(this.element.style.left || '0'),
            parseInt(this.element.style.top || '0')
        );
        this.elementStartPos = this.elementStartPos.Check();

        hookEvent(document, "mousemove", this.boundDragGo);
        hookEvent(document, "mouseup", this.boundDragStopHook);

        return cancelEvent(eventObj);
    }

    private dragGo(eventObj: MouseEvent): false {
        if (!this.dragging || this.disposed) return false; // Should not happen

        let newPos = absoluteCursorPosition(eventObj);
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

    private dragStopHook(eventObj: MouseEvent): false {
        this.dragStop();
        return cancelEvent(eventObj);
    }

    private dragStop(): void {
        if (!this.dragging || this.disposed) return;
        unhookEvent(document, "mousemove", this.boundDragGo);
        unhookEvent(document, "mouseup", this.boundDragStopHook);

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
        // Nullify references to DOM elements and callbacks to help GC
        // this.element = null; // Cannot assign to 'element' because it is a read-only property.
        // this.attachElement = null; // Same here
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
        hookEvent(this.attachElement, "mousedown", this.boundDragStart);
    }

    public StopListening(stopCurrentDragging?: boolean): void {
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
