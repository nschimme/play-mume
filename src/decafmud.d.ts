// src/decafmud.d.ts

// Define the structure of the DecafMUD instance
interface DecafMUDInstance {
  textInputFilter?: any; // Property accessed in src/index.ts
  socket: DecafMUDSocket; // Added this line
  // Add other known properties/methods of an instance if available
  // For example, from the original inline script:
  // host: string;
  // port: number;
  // socket: DecafMUDSocket; // Already partially defined
}

// Define the structure of the DecafMUD constructor/static object
interface DecafMUDStatic {
  new (options: any): DecafMUDInstance; // Constructor
  plugins?: {
    TextInputFilter?: any; // Property accessed in src/index.ts
  };
  instances?: DecafMUDInstance[]; // Property accessed in src/index.ts
}

// Declare DecafMUD as a global variable
declare var DecafMUD: DecafMUDStatic;

// Keep DecafMUDSocket or expand it
declare interface DecafMUDSocket {
  write(data: string): void;
  // Add other known properties/methods
}
