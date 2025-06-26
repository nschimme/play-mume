/*
 * dragelement.js - Make HTML elements draggable
 * Code originally from http://www.switchonthecode.com/tutorials/javascript-draggable-elements
 * Adapted for TypeScript by Jules.
 */

function hookEvent(element: HTMLElement | Window | Document | string, eventName: string, callback: EventListener): void {
    let el: HTMLElement | Window | Document | null = null;
    if (typeof element === "string") {
        el = document.getElementById(element);
    } else {
        el = element;
    }

    if (el == null) return;

    if (el.addEventListener) {
        el.addEventListener(eventName, callback, false);
    } else if ((el as any).attachEvent) {
        (el as any).attachEvent("on" + eventName, callback);
    }
}

function unhookEvent(element: HTMLElement | Window | Document | string, eventName: string, callback: EventListener): void {
    let el: HTMLElement | Window | Document | null = null;
    if (typeof element === "string") {
        el = document.getElementById(element);
    } else {
        el = element;
    }

    if (el == null) return;

    if (el.removeEventListener) {
        el.removeEventListener(eventName, callback, false);
    } else if ((el as any).detachEvent) {
        (el as any).detachEvent("on" + eventName, callback);
    }
}

function cancelEvent(e: Event): false {
    e = e || window.event; // For older IE
    if (e.stopPropagation) e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    (e as any).cancelBubble = true; // IE
    // e.cancel = true; // Non-standard
    (e as any).returnValue = false; // IE
    return false;
}

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
            if (!isNaN(val.X)) newPos.X += val.X;
            if (!isNaN(val.Y)) newPos.Y += val.Y;
        }
        return newPos;
    }

    public Subtract(val: Position | null): Position {
        const newPos = new Position(this.X, this.Y);
        if (val != null) {
            if (!isNaN(val.X)) newPos.X -= val.X;
            if (!isNaN(val.Y)) newPos.Y -= val.Y;
        }
        return newPos;
    }

    public Min(val: Position | null): Position {
        const newPos = new Position(this.X, this.Y);
        if (val == null) return newPos;
        if (!isNaN(val.X) && this.X > val.X) newPos.X = val.X;
        if (!isNaN(val.Y) && this.Y > val.Y) newPos.Y = val.Y;
        return newPos;
    }

    public Max(val: Position | null): Position {
        const newPos = new Position(this.X, this.Y);
        if (val == null) return newPos;
        if (!isNaN(val.X) && this.X < val.X) newPos.X = val.X;
        if (!isNaN(val.Y) && this.Y < val.Y) newPos.Y = val.Y;
        return newPos;
    }

    public Bound(lower: Position | null, upper: Position | null): Position {
        // Start with the current position's values but in a new base Position object
        let currentPos = new Position(this.X, this.Y);
        if (lower) currentPos = currentPos.Max(lower); // Max returns a new Position
        if (upper) currentPos = currentPos.Min(upper); // Min returns a new Position
        return currentPos;
    }

    public Check(): Position {
        const newPos = new Position(this.X, this.Y);
        if (isNaN(newPos.X)) newPos.X = 0;
        if (isNaN(newPos.Y)) newPos.Y = 0;
        return newPos;
    }

    public Apply(element: HTMLElement | string | null): void {
        let el: HTMLElement | null = null;
        if (typeof element === "string") {
            el = document.getElementById(element);
        } else {
            el = element;
        }
        if (el == null) return;

        if (!isNaN(this.X)) el.style.left = this.X + 'px';
        if (!isNaN(this.Y)) el.style.top = this.Y + 'px';
    }
}

function absoluteCursorPostion(eventObj: MouseEvent): Position {
    eventObj = eventObj || window.event as MouseEvent; // For older IE

    if (isNaN(window.scrollX)) { // IE < 9
        const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        return new Position(eventObj.clientX + scrollLeft, eventObj.clientY + scrollTop);
    } else {
        return new Position(eventObj.clientX + window.scrollX, eventObj.clientY + window.scrollY);
    }
}

type DragEventCallback = (eventOrElement: MouseEvent | HTMLElement, element?: HTMLElement) => void;


export class dragObject {
    private element: HTMLElement | null;
    private attachElement: HTMLElement | null;
    private lowerBound: Position | null;
    private upperBound: Position | null;
    private startCallback: DragEventCallback | null;
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
        startCallback?: DragEventCallback | null,
        moveCallback?: ((pos: Position, el: HTMLElement) => void) | null,
        endCallback?: ((el: HTMLElement) => void) | null,
        attachLater?: boolean
    ) {
        if (typeof element === "string") {
            this.element = document.getElementById(element);
        } else {
            this.element = element;
        }

        if (this.element == null) {
            // console.error("dragObject: Element to drag not found or is null.");
            // To prevent further errors, we can set disposed, though constructor can't return early easily.
            this.disposed = true;
        }

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

        if (typeof attachElement === "string") {
            this.attachElement = document.getElementById(attachElement);
        } else {
            this.attachElement = attachElement || this.element;
        }

        if (this.attachElement == null && this.element != null) {
            this.attachElement = this.element; // Default if attachElement is null but element is not
        }


        // Bind methods to ensure 'this' context
        this.dragStart = this.dragStart.bind(this);
        this.dragGo = this.dragGo.bind(this);
        this.dragStopHook = this.dragStopHook.bind(this);

        if (!attachLater && !this.disposed) {
            this.StartListening();
        }
    }

    private dragStart(eventObj: MouseEvent): false | void {
        if (this.dragging || !this.listening || this.disposed || !this.element) return;
        this.dragging = true;

        if (this.startCallback != null) {
            this.startCallback(eventObj, this.element);
        }

        this.cursorStartPos = absoluteCursorPostion(eventObj);

        // Ensure style is defined before trying to parse left/top
        if(!this.element.style.left) this.element.style.left = "0px";
        if(!this.element.style.top) this.element.style.top = "0px";

        this.elementStartPos = new Position(parseInt(this.element.style.left, 10), parseInt(this.element.style.top, 10));
        this.elementStartPos = this.elementStartPos.Check();

        hookEvent(document, "mousemove", this.dragGo as EventListener);
        hookEvent(document, "mouseup", this.dragStopHook as EventListener);

        return cancelEvent(eventObj);
    }

    private dragGo(eventObj: MouseEvent): false | void {
        if (!this.dragging || this.disposed || !this.element || !this.elementStartPos || !this.cursorStartPos) return;

        let newPos = absoluteCursorPostion(eventObj);
        newPos = newPos.Add(this.elementStartPos).Subtract(this.cursorStartPos);
        newPos = newPos.Bound(this.lowerBound, this.upperBound);
        newPos.Apply(this.element);

        if (this.moveCallback != null) {
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
        unhookEvent(document, "mousemove", this.dragGo as EventListener);
        unhookEvent(document, "mouseup", this.dragStopHook as EventListener);
        this.cursorStartPos = null;
        this.elementStartPos = null;
        if (this.endCallback != null && this.element) {
            this.endCallback(this.element);
        }
        this.dragging = false;
    }

    public Dispose(): void {
        if (this.disposed) return;
        this.StopListening(true);
        this.element = null;
        this.attachElement = null;
        this.lowerBound = null;
        this.upperBound = null;
        this.startCallback = null;
        this.moveCallback = null;
        this.endCallback = null;
        this.disposed = true;
    }

    public StartListening(): void {
        if (this.listening || this.disposed || !this.attachElement) return;
        this.listening = true;
        hookEvent(this.attachElement, "mousedown", this.dragStart as EventListener);
    }

    public StopListening(stopCurrentDragging?: boolean): void {
        if (!this.listening || this.disposed || !this.attachElement) return;
        unhookEvent(this.attachElement, "mousedown", this.dragStart as EventListener);
        this.listening = false;

        if (stopCurrentDragging && this.dragging) {
            this.dragStop();
        }
    }

    public IsDragging = (): boolean => this.dragging;
    public IsListening = (): boolean => this.listening;
    public IsDisposed = (): boolean => this.disposed;
}

// Make dragObject available globally for existing JS code that might expect it.
// This is a temporary measure during migration.
if (typeof window !== 'undefined') {
    (window as any).dragObject = dragObject;
    (window as any).Position = Position; // If Position class is also needed globally
}
