import { formatOfferPrice } from '@kora/core';
export const money = (value: number) => formatOfferPrice(value);
import { brand as sharedBrand } from '../../../../config/brand-presentation';
export const brand = { ...sharedBrand, name: 'MAYAMI', shortName: 'MAYAMI' };
