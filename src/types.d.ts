import { MumeXmlParser } from './mume.mapper';

interface InflateStream {
  decompress(data: string | number[]): Uint8Array;
}

interface Zlib {
  InflateStream: {
    new(): InflateStream;
  };
}

interface DecafMUDInstance {
    textInputFilter?: MumeXmlParser;
    socket: {
        write(data: string): void;
    };
}

interface DecafMUDStatic {
    new(options: Record<string, unknown>): DecafMUDInstance;
    plugins: {
        TextInputFilter: {
            [key: string]: unknown;
        };
    };
    instances: DecafMUDInstance[];
}

declare global {
  interface Window {
    Zlib: Zlib;
    DecafMUD: DecafMUDStatic;
  }
}
