/**
 * Makes an HTML element draggable.
 * @param element The element to make draggable.
 * @param handle The specific part of the element that should be used as the drag handle.
 *               If not provided, the entire element is the handle.
 */
export function makeDraggable(element: HTMLElement, handle?: HTMLElement): void {
  const dragHandle = handle ?? element;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  // Ensure the element is positioned absolutely or relatively
  const position = window.getComputedStyle(element).position;
  if (position !== 'absolute' && position !== 'fixed' && position !== 'relative') {
    element.style.position = 'relative';
  }

  dragHandle.style.cursor = 'move';

  const onMouseDown = (e: MouseEvent) => {
    // Prevent dragging from starting on interactive elements like inputs or buttons
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLButtonElement
    ) {
      return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = element.offsetLeft;
    initialY = element.offsetTop;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Prevent default browser actions like text selection
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    element.style.left = `${initialX + dx}px`;
    element.style.top = `${initialY + dy}px`;
  };

  const onMouseUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  dragHandle.addEventListener('mousedown', onMouseDown);
}
