import { DecafMUD } from '../decafmud';
import { Plugin } from '../types';

class SettingsManager {
  private decaf: DecafMUD;
  private settings: {
    fontPercentage: number;
    fkeyMacros: boolean;
    numpadWalking: boolean;
    showProgressBars: boolean;
    showMap: boolean;
  };

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
    this.settings = {
      fontPercentage: 100,
      fkeyMacros: true,
      numpadWalking: true,
      showProgressBars: false,
      showMap: false,
    };
    // In a real scenario, these would be loaded from storage
  }

  public setFontSize(k: number): void {
    this.settings.fontPercentage = k;
    const ui = this.decaf.ui as { el_display?: HTMLElement };
    if (ui && ui.el_display) {
      ui.el_display.style.fontSize = `${(k * 110) / 100}%`;
    }
  }

  public getFontSize(): number {
    return this.settings.fontPercentage;
  }

  public setFKeysEnabled(enabled: boolean): void {
    this.settings.fkeyMacros = enabled;
  }

  public areFKeysEnabled(): boolean {
    return this.settings.fkeyMacros;
  }

  // ... other getters and setters
}

class PanelsSettingsPlugin implements Plugin {
  public readonly name = 'panels-settings';

  public install(decaf: DecafMUD): void {
    const settingsManager = new SettingsManager(decaf);
    (decaf as { settingsManager?: SettingsManager }).settingsManager = settingsManager;
  }
}

export const panelsSettingsPlugin = new PanelsSettingsPlugin();
