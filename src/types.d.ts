
interface InflateStream {
  decompress(data: string | number[]): Uint8Array;
}

interface Zlib {
  InflateStream: {
    new(): InflateStream;
  };
}

type MumeXmlParser = import('./mume.mapper').MumeXmlParser;

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

declare var Zlib: Zlib;
declare var DecafMUD: DecafMUDStatic;
