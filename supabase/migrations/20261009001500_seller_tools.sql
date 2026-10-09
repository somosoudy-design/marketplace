-- Seller panel reads. Sellers can't read orders (they belong to the buyer), so these functions return
-- only what a store needs to prepare and account for its own deliveries: the order number, whether the
-- payment that unlocks shipping is confirmed, the delivery address and the store's own lines.

create or replace function public.seller_fulfillments(p_store_id uuid, p_scope text default 'open')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_store_member(p_store_id);
  return coalesce((
    select jsonb_agg(x order by x.placed_at desc)
      from (
        select f.id, f.order_id, f.seq, f.store_id, f.flow, f.status, f.shipping_method_name, f.shipping_kind, f.shipping_usd,
               f.eta_min_date, f.eta_max_date, f.carrier_name, f.tracking_number, f.cargo_batch_id, f.delivered_at, f.created_at, f.ship_to,
               o.number as order_number, o.placed_at, o.status as order_status,
               public._order_payment_level(o.id) as payment_level,
               (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'variant_title', i.variant_title, 'image_path', i.image_path,
                                                             'quantity', i.quantity, 'refunded_qty', i.refunded_qty, 'unit_price_usd', i.unit_price_usd,
                                                             'line_total_usd', i.line_total_usd, 'commission_usd', i.commission_usd) order by i.title), '[]')
                  from public.order_items i where i.fulfillment_id = f.id) as items,
               (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'step_code', e.step_code, 'note', e.note, 'source', e.source,
                                                             'visible_to_buyer', e.visible_to_buyer, 'created_at', e.created_at) order by e.id), '[]')
                  from public.fulfillment_events e where e.fulfillment_id = f.id) as fulfillment_events
          from public.fulfillments f
          join public.orders o on o.id = f.order_id
         where f.store_id = p_store_id
           and case coalesce(p_scope, 'open')
                 when 'open' then f.status not in ('delivered', 'cancelled') and o.status <> 'cancelled'
                 when 'done' then (f.status in ('delivered', 'cancelled') or o.status = 'cancelled') and f.created_at > now() - interval '180 days'
                 else true end
         order by o.placed_at desc
         limit 200
      ) x), '[]'::jsonb);
end $$;

-- Sales ledger for the store: one row per line, with the commission fixed when the order was placed.
create or replace function public.seller_sales(p_store_id uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_store_member(p_store_id);
  return coalesce((
    select jsonb_agg(x order by x.placed_at desc)
      from (
        select i.id, o.number as order_number, o.placed_at, o.status as order_status, o.payment_status, f.status as fulfillment_status, f.flow,
               i.title, i.variant_title, i.quantity, i.refunded_qty, i.unit_price_usd, i.line_total_usd, i.refunded_usd,
               i.commission_pct, i.commission_usd,
               (i.line_total_usd - i.refunded_usd - i.commission_usd) as net_usd
          from public.order_items i
          join public.orders o on o.id = i.order_id
          join public.fulfillments f on f.id = i.fulfillment_id
         where i.store_id = p_store_id
           and o.placed_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 366))
         order by o.placed_at desc
         limit 500
      ) x), '[]'::jsonb);
end $$;

-- Sellers manage only rates for deliveries they ship themselves, and those are real rates.
drop policy if exists rates_seller on public.shipping_rates;
create policy rates_seller on public.shipping_rates for all
  using (store_id is not null and public.is_store_member(store_id))
  with check (store_id is not null and public.is_store_member(store_id) and flows <@ '{seller_shipping}'::public.fulfillment_flow[] and not is_demo);
