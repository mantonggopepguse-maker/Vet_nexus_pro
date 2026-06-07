export const toLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
};

export const formatDateOnly = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
  locales?: Intl.LocalesArgument
) => parseDateOnly(value).toLocaleDateString(locales, options);
