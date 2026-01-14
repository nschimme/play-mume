import { DecafMUD } from '../decafmud';
import { Plugin } from '../types';

// TELNET Constants (assuming these are defined in a central place)
const TN = {
  IAC: '\xFF',
  SB: '\xFA',
  SE: '\xF0',
  GMCP: '\xC9',
};

class GMCPHandler {
  private decaf: DecafMUD;
  private pingTimer: number | undefined;
  private pingWhen?: Date;
  private pingCount = 0;
  private pingAverage = 0;
  private pingDelay = 60; // in seconds

  constructor(decaf: DecafMUD) {
    this.decaf = decaf;
    (this.decaf as { gmcp?: GMCPHandler }).gmcp = this; // For external access if needed
  }

  public connect(): void {
    this.sendGMCP("Core.Hello", {
      client: "DecafMUD",
      version: DecafMUD.version.toString(),
    });
    this.startPing();
  }

  public disconnect(): void {
    this.stopPing();
    this.pingAverage = 0;
    this.pingCount = 0;
  }

  public handleSubnegotiation(data: string): void {
    const spaceIndex = data.indexOf(' ');
    const pckg = spaceIndex === -1 ? data : data.substring(0, spaceIndex);
    const jsonData = spaceIndex === -1 ? '' : data.substring(spaceIndex + 1);

    if (pckg.length === 0) return;

    let message;
    try {
      message = jsonData ? JSON.parse(jsonData) : undefined;
    } catch (e) {
      this.decaf.debugString(`Invalid GMCP JSON for ${pckg}: ${jsonData}`, 'warn');
      return;
    }

    this.decaf.debugString(`Received GMCP: ${pckg}`, 'info');

    // Simple dispatcher (can be expanded)
    if (pckg === 'Core.Ping') {
      this.handleCorePing();
    } else if (pckg === 'Core.Goodbye') {
        this.handleCoreGoodbye(message);
    }
  }

  private sendGMCP(pckg: string, data?: unknown): void {
    const jsonData = data ? ` ${JSON.stringify(data)}` : '';
    const iacSequence = `${TN.IAC}${TN.SB}${TN.GMCP}${pckg}${jsonData}${TN.IAC}${TN.SE}`;
    (this.decaf as { sendIAC: (data: string) => void }).sendIAC(iacSequence); // Assumes sendIAC on DecafMUD
  }

  private handleCoreGoodbye(message: unknown): void {
      if(message) {
        this.decaf.debugString(`Reason for disconnect: ${message}`);
      }
  }

  private handleCorePing(): void {
    if (this.pingWhen) {
      const rtt = new Date().getTime() - this.pingWhen.getTime();
      this.pingCount++;
      this.pingAverage = Math.ceil((rtt + (this.pingAverage * (this.pingCount - 1))) / this.pingCount);
      this.decaf.debugString(`Ping RTT: ${rtt}ms (avg: ${this.pingAverage}ms)`);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.pingWhen = new Date();
      this.sendGMCP('Core.Ping');
    }, this.pingDelay * 1000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }
}

class GMCPPlugin implements Plugin {
  public readonly name = 'gmcp';

  public install(decaf: DecafMUD): void {
    // GMCP is a telnet option, so it needs to be integrated with the IAC parser
    // This is a placeholder for a more robust telnet option registration system
    const gmcpHandler = new GMCPHandler(decaf);
    (decaf as { telopt: Record<string, unknown> }).telopt[TN.GMCP] = {
        _will: () => gmcpHandler.connect(),
        _wont: () => gmcpHandler.disconnect(),
        _sb: (data: string) => gmcpHandler.handleSubnegotiation(data),
        disconnect: () => gmcpHandler.disconnect(),
    };
  }
}

export const gmcpPlugin = new GMCPPlugin();
