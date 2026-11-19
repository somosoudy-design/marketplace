import { otpDigits } from '@kora/core';

// Marketplace issues eight digits. Six-digit codes from earlier configurations can be submitted explicitly.
export const EMAIL_CODE_LENGTH = 8;
export const validEmailCode = (value: string) => /^\d{6,8}$/.test(value);

export function nextEmailCode(input: string, previous: string) {
  const digits = input.replace(/\D/g, '');
  const replaceFull = previous.length === EMAIL_CODE_LENGTH && digits.length > EMAIL_CODE_LENGTH && digits.startsWith(previous);
  return otpDigits(replaceFull ? digits.slice(previous.length) : digits, EMAIL_CODE_LENGTH);
}
