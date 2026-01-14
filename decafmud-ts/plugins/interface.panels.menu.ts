import { DecafMUD } from '../decafmud';
import { Plugin } from '../types';

// Define the structure of a menu item
interface MenuItem {
  name: string;
  id: string;
  tooltip: string;
  submenu: { name: string; action: () => void }[];
}

// Define the menus
function getToolbarMenus(decaf: DecafMUD): MenuItem[] {
    return [
      {
        name: 'File',
        id: 'menu_file',
        tooltip: 'Used for (re-)connecting.',
        submenu: [
          { name: 'Reconnect', action: () => decaf.reconnect() },
        ],
      },
      {
        name: 'Log',
        id: 'menu_log',
        tooltip: 'Create a log file for this session.',
        submenu: [
          { name: 'HTML log', action: () => menu_log(decaf, 'html') },
          { name: 'Plain Text Log', action: () => menu_log(decaf, 'plain') },
        ],
      },
      // Add other menus here...
    ];
}

function menu_log(decaf: DecafMUD, style: 'html' | 'plain'): void {
  // Implementation of the logging functionality
  const ui = decaf.ui as { display: { getRawContent: () => string }, showPopup: (title: string, content: string) => void };
  if (!ui) return;

  const content = ui.display.getRawContent(); // Assume display has this method
  let logContent = '';

  if (style === 'plain') {
    logContent = content.replace(/<br>/g, '\n').replace(/<.*?>/g, '');
  } else {
    logContent = `<html><head><title>DecafMUD Log</title></head><body>${content}</body></html>`;
  }

  // Since we can't save directly, show it in a popup.
  ui.showPopup('Log', `<textarea>${logContent}</textarea>`);
}


class PanelsMenuPlugin implements Plugin {
  public readonly name = 'panels-menu';

  public install(decaf: DecafMUD): void {
    const ui = decaf.ui as { addToolbarButton: (name: string, id: string, action: () => void, tooltip: string) => void, container: HTMLElement };
    if (ui && ui.addToolbarButton) {
        const toolbarMenus = getToolbarMenus(decaf);
      toolbarMenus.forEach((menu) => {
        ui.addToolbarButton(menu.name, menu.id, () => this.toggleMenu(ui, menu.id, toolbarMenus), menu.tooltip);
        this.createSubmenu(ui, menu, toolbarMenus);
      });
    }
  }

  private createSubmenu(ui: { addToolbarButton: (name: string, id: string, action: () => void, tooltip: string) => void, container: HTMLElement }, menu: MenuItem, toolbarMenus: MenuItem[]): void {
    const submenu = document.createElement('ul');
    submenu.id = `sub_${menu.id}`;
    submenu.className = 'submenu';

    menu.submenu.forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = item.name;
      a.onclick = (e) => {
        e.preventDefault();
        item.action();
        this.closeAllMenus(ui, toolbarMenus);
      };
      li.appendChild(a);
      submenu.appendChild(li);
    });

    ui.container.appendChild(submenu);
  }

  private toggleMenu(ui: { addToolbarButton: (name: string, id: string, action: () => void, tooltip: string) => void, container: HTMLElement }, menuId: string, toolbarMenus: MenuItem[]): void {
    const submenu = document.getElementById(`sub_${menuId}`);
    if (submenu) {
      const isVisible = submenu.style.visibility === 'visible';
      this.closeAllMenus(ui, toolbarMenus);
      if (!isVisible) {
        submenu.style.visibility = 'visible';
        // Position it below the button...
      }
    }
  }

  private closeAllMenus(_ui: { addToolbarButton: (name: string, id: string, action: () => void, tooltip: string) => void, container: HTMLElement }, toolbarMenus: MenuItem[]): void {
      toolbarMenus.forEach(menu => {
          const submenu = document.getElementById(`sub_${menu.id}`);
          if (submenu) {
              submenu.style.visibility = 'hidden';
          }
      });
  }
}

export const panelsMenuPlugin = new PanelsMenuPlugin();
