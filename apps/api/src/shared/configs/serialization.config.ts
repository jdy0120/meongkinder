declare global {
  interface BigInt {
    toJSON(): number;
  }
  interface Set<T> {
    toJSON(): T[];
  }
  interface Map<K, V> {
    toJSON(): Record<K extends any ? string : never, V>;
  }
  interface RegExp {
    toJSON(): string;
  }
  interface Error {
    toJSON(): { name: string; message: string; stack?: string };
  }
}

// 1. BigInt serialization patch for JSON.stringify (Prisma BigInt support)
if (!Object.prototype.hasOwnProperty.call(BigInt.prototype, "toJSON")) {
  Object.defineProperty(BigInt.prototype, "toJSON", {
    value: function (this: bigint) {
      return Number(this);
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

// 2. Set serialization patch for JSON.stringify
if (!Object.prototype.hasOwnProperty.call(Set.prototype, "toJSON")) {
  Object.defineProperty(Set.prototype, "toJSON", {
    value: function (this: Set<unknown>) {
      return Array.from(this);
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

// 3. Map serialization patch for JSON.stringify
if (!Object.prototype.hasOwnProperty.call(Map.prototype, "toJSON")) {
  Object.defineProperty(Map.prototype, "toJSON", {
    value: function (this: Map<any, any>) {
      return Object.fromEntries(
        this as Iterable<readonly [PropertyKey, unknown]>,
      ) as Record<string, unknown>;
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

// 4. RegExp serialization patch for JSON.stringify
if (!Object.prototype.hasOwnProperty.call(RegExp.prototype, "toJSON")) {
  Object.defineProperty(RegExp.prototype, "toJSON", {
    value: function (this: RegExp) {
      return this.toString();
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

// 5. Error serialization patch for JSON.stringify
if (!Object.prototype.hasOwnProperty.call(Error.prototype, "toJSON")) {
  Object.defineProperty(Error.prototype, "toJSON", {
    value: function (this: Error) {
      return {
        name: this.name,
        message: this.message,
        stack: this.stack,
      };
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

export {};
