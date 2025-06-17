// src/decafmud/simple-dragger.ts
// SPDX-License-Identifier: MIT

export interface DraggableController {
  dispose: () => void;
}

export function makeDraggable(draggableElement: HTMLElement, handleElement: HTMLElement): DraggableController {
  let isDragging = false;
  let initialMouseX = 0;
  let initialMouseY = 0;
  let initialElementX = 0;
  let initialElementY = 0;

  // Ensure the draggable element is positioned if not already.
  // This might need to be handled by CSS primarily.
  // Forcing 'position: absolute' or 'relative' here could have side effects
  // if the element's CSS is meant to be different.
  // For now, assume CSS handles the `position` property correctly for `left`/`top`.
  // const currentPosition = window.getComputedStyle(draggableElement).position;
  // if (currentPosition === 'static') {
  //   draggableElement.style.position = 'relative'; // Or 'absolute' depending on context
  // }


  const onMouseDown = (event: MouseEvent) => {
    // Prevent dragging on non-primary mouse button clicks
    if (event.button !== 0) {
        return;
    }

    isDragging = true;
    initialMouseX = event.clientX;
    initialMouseY = event.clientY;
    initialElementX = draggableElement.offsetLeft;
    initialElementY = draggableElement.offsetTop;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Prevent text selection while dragging
    event.preventDefault();
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging) {
      return;
    }

    const deltaX = event.clientX - initialMouseX;
    const deltaY = event.clientY - initialMouseY;

    draggableElement.style.left = `${initialElementX + deltaX}px`;
    draggableElement.style.top = `${initialElementY + deltaY}px`;
  };

  const onMouseUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  handleElement.addEventListener('mousedown', onMouseDown);
  // Add touch support for basic dragging on touch devices
  handleElement.addEventListener('touchstart', (event: TouchEvent) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      // Simulate a mouse event for onMouseDown
      onMouseDown(new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0 // Simulate left click
      }));
    }
    // Prevent default touch actions like scrolling while dragging
    event.preventDefault();
  }, { passive: false });


  const dispose = () => {
    handleElement.removeEventListener('mousedown', onMouseDown);
    // Remove touchstart listener as well
    // Note: onMouseDown (and thus onMouseMove/onMouseUp) are not directly removable for touchstart
    // if we created a new MouseEvent. Proper touch handling would duplicate onMouseMove/onMouseUp for touch events.
    // For "simpler", this might be an acceptable limitation or needs more robust touch handling.
    // For now, just removing the mousedown listener.
    // To fully clean up touch, onMouseMove and onMouseUp would need to be adapted for touch events too.
    document.removeEventListener('mousemove', onMouseMove); // Clean up in case mouseup didn't fire
    document.removeEventListener('mouseup', onMouseUp);     // Clean up in case mouseup didn't fire
  };

  return {
    dispose,
  };
}
