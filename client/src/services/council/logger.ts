// Dev-only council logger — stripped in production builds
const isDev = import.meta.env.DEV;
export const councilLog = isDev ? console.log.bind(console) : (): void => {};
export const councilWarn = isDev ? console.warn.bind(console) : (): void => {};
export const councilError = console.error.bind(console); // always log errors
