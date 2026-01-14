import { DecafMUD } from '../decafmud';
import { Plugin } from '../types';
import { makeDraggable } from '../draggable';

class PanelsInterface {
  private decaf: DecafMUD;
  public container: HTMLElement;
  private display: { message: (text: string, className?: string) => void } | undefined;
  private input: HTMLInputElement | HTMLTextAreaElement;

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
    const containerId = this.decaf.options.set_interface?.container;

    if (!containerId) {
      throw new Error('Interface container not specified in options.');
    }

    this.container = typeof containerId === 'string'
        ? document.querySelector(containerId) as HTMLElement
        : containerId;

    if (!this.container) {
        throw new Error(`Container element '${containerId}' not found.`);
    }

    this.setupDOM();
    this.setupInput();
  }

  private setupDOM(): void {
    this.container.className += ' decafmud mud interface';

    // Main display
    const displayEl = document.createElement('div');
    displayEl.className = 'decafmud mud-pane primary-pane';
    this.container.appendChild(displayEl);

    const header = document.createElement('div');
    header.className = 'decafmud mud-pane-header';
    header.textContent = 'Main Display';
    displayEl.appendChild(header);

    makeDraggable(displayEl, header);

    // This is a placeholder until the real display is registered.
    this.decaf.options.set_interface!.container = displayEl;

    // Input container
    const inputCont = document.createElement('div');
    inputCont.className = 'decafmud input-cont';
    this.container.appendChild(inputCont);

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'decafmud input';
    inputCont.appendChild(this.input);
  }

  private setupInput(): void {
    this.input.addEventListener('keydown', (e) => this.handleInput(e));
    this.input.focus();
  }

  private handleInput(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = this.input.value;
      if (value) {
        this.decaf.sendInput(value);
        if (this.decaf.options.set_interface?.clearonsend) {
          this.input.value = '';
        }
      }
    }
  }

  public displayInput(text: string): void {
    if (this.display) {
      this.display.message(text, 'user-input');
    }
  }

  public connected(): void {
      if (this.display) {
        this.display.message('*** CONNECTED ***');
      }
  }

  public disconnected(): void {
      if (this.display) {
          this.display.message('*** DISCONNECTED ***');
      }
  }

  public addToolbarButton(_name: string, _id: string, _action: () => void, _tooltip: string): void {
      // Stub for now
  }

  public showPopup(_title: string, _content: string): void {
      // Stub for now
  }
}

class PanelsInterfacePlugin implements Plugin {
  public readonly name = 'panels';

  public install(decaf: DecafMUD): void {
    decaf.registerInterface('panels', PanelsInterface);
  }
}

export const panelsInterfacePlugin = new PanelsInterfacePlugin();
