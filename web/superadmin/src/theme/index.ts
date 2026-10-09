import { darkTheme } from './dark';
import { boxTheme } from './boxitt';
import { lightTheme } from './light';
import { AppTheme } from './types';

export * from './types';
export * from './dark';
export * from './boxitt';
export * from './light';

export const themes: Record<AppTheme['name'], AppTheme> = {
  dark: darkTheme,
  boxitt: boxTheme,
  light: lightTheme,
};
