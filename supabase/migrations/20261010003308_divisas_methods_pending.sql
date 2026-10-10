-- Which methods take the divisas price (the day's gap) is a commercial decision per method. The engine migration
-- turned on every USD/USDT method; cash in dollars and PayPal go back to the main price until Oliver decides
-- (docs/PRECIOS.md). Zelle, USDT TRC-20 and Binance Pay (USDT) keep the divisas price. Admins change it per method in
-- Panel › Configuración › Métodos de pago.
update public.payment_methods set price_basis = 'bcv' where code in ('efectivo_usd', 'paypal');
