-- Local preparation only, no remote deployment authorized.
-- Same read model as seller_fulfillments, restricted to one delivery independent of pagination/age.
create or replace function public.seller_fulfillment_detail(p_store_id uuid, p_fulfillment_id uuid)
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
           and f.id = p_fulfillment_id
         order by o.placed_at desc

      ) x), '[]'::jsonb) -> 0;
end $$;


create or replace function public.seller_orders_ready() returns boolean
language sql stable security invoker set search_path=public as $$ select true $$;
revoke all on function public.seller_fulfillment_detail(uuid,uuid),public.seller_orders_ready() from public,anon;
grant execute on function public.seller_fulfillment_detail(uuid,uuid),public.seller_orders_ready() to authenticated,service_role;
