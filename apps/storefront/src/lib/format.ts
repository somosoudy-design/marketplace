export const money = (value: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value);
export { default as brand } from '../../../../config/brand.json';
