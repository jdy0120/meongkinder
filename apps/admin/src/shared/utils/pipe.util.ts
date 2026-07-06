function pipe<T>(...functions: ((value: T) => T)[]) {
  return function (initialValue: T) {
    return functions.reduce((value, fn) => fn(value), initialValue);
  };
}

export default pipe;
