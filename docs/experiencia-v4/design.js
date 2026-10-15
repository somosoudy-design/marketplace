(() => {
  'use strict';
  // Isolated design prototype. No fetch, account, API, charge, financial rule or remote write.
  // Arithmetic only keeps editable EXAMPLE quantities coherent. It is not a production price engine.
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${(ICONS[n] || ICONS.box).map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}></${tag}>`).join('')}</svg>`;
  const money = (n, currency = 'USD') => new Intl.NumberFormat('es-VE', { style:'currency', currency, minimumFractionDigits:2 }).format(n);
  const button = (text, action, cls = 'primary', attrs = '') => `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
  const ib = (name, label, action, extra = '') => button(icon(name), action, 'icon-btn', `aria-label="${esc(label)}" ${extra}`);
  const image = (p, cls = '', photo = 0) => `<img class="${cls}" src="${p.photos[photo].src}" alt="${esc(p.title)}" decoding="async">`;
  const q = new URLSearchParams(location.search);
  const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = q.get('theme') || (systemDark ? 'dark' : 'light');
  let screen = location.hash.slice(1) || q.get('screen') || 'cart';
  let cart = [{id:0, qty:1}, {id:1, qty:1}], ordered = [], created = false, reported = false;
  let address = 'Casa', productId = 0, photo = 0, query = '', category = 'Todo', sort = 'relevance', lowPrice = false;
  let method = 'pago_movil', reference = '', attachment = '', busy = false, historyDepth = 0, modalTrigger;
  const saved = new Set(), delivery = {HAYAZGO:'home', Voltio:'home'};
  const items = () => created && !['cart','home','catalog','product','favorites'].includes(screen) ? ordered : cart;
  const units = (list = items()) => list.reduce((s,l)=>s+l.qty,0);
  const stores = (list = items()) => [...new Set(list.map(l=>CATALOG[l.id].store))];
  const subtotal = (list = items()) => list.reduce((s,l)=>s+CATALOG[l.id].price*l.qty,0);
  const shipping = (list = items()) => stores(list).reduce((s,store)=>s+(delivery[store]==='home'?4:0),0);
  const total = (list = items()) => subtotal(list)+shipping(list);
  const shippingLabel = (store) => delivery[store] === 'home' ? 'A domicilio' : 'Retiro en tienda';
  const price = (p) => `<span class="money">${money(p.price)}</span>`;
  function go(next) {
    closeSheet();
    if (next === screen) return;
    historyDepth++;
    history.pushState({ screen:next }, '', '#'+next);
    screen = next; render(); $('#main').focus({preventScroll:true});
  }
  addEventListener('popstate', () => { screen = location.hash.slice(1) || q.get('screen') || 'cart'; historyDepth=Math.max(0,historyDepth-1); closeSheet(); render(); });
  function back() { if(historyDepth) history.back(); else go(created ? 'order' : 'catalog'); }
  function toast(text) { $('#feedback').textContent=text; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#feedback').textContent='',2600); }
  function sheet(title, body) {
    modalTrigger=document.activeElement;
    $('#sheet').innerHTML=`<div class="sheet-header"><h2 id="sheet-title">${title}</h2>${ib('x','Cerrar','close')}</div><div class="sheet-body">${body}</div>`;
    $('#sheet').showModal();
  }
  function closeSheet() { if($('#sheet').open) $('#sheet').close(); }
  $('#sheet').addEventListener('close',()=>{ if(modalTrigger?.isConnected) modalTrigger.focus({preventScroll:true}); });
  function progress(step) {
    return `<div class="step-progress" aria-label="Paso ${step} de 3"><span class="${step===1?'active':''}">${step>1?icon('check'):'1.'} Entrega</span><i class="rule"></i><span class="${step===2?'active':''}">${step>2?icon('check'):'2.'} Revisión</span><i class="rule"></i><span class="${step===3?'active':''}">3. Pago</span></div>`;
  }
  function header(title, step=0, right='') { return `<div class="topbar">${ib('chevron-left','Volver','back')}<h1>${title}</h1>${right}</div>${step?progress(step):''}`; }
  function navigation(active) {
    return `<nav class="tabbar" aria-label="Navegación principal">${[['home','house','Inicio'],['catalog','search','Buscar'],['cart','shopping-bag','Carrito'],['account','user','Cuenta']].map(([id,ic,label])=>button(`<span class="tab-icon">${icon(ic)}${id==='cart'&&units(cart)?`<span class="cart-count">${units(cart)}</span>`:''}</span><span>${label}</span>`,id,'tab'+(active===id?' active':''),`${active===id?'aria-current="page"':''}`)).join('')}</nav>`;
  }
  function dock(label, action, opts={}) {
    return `<div class="action-dock">${opts.commitment?`<p class="commitment">${opts.commitment}</p>`:''}<div class="row">${opts.noTotal?'':`<div class="amount"><div class="small">${opts.caption||'Total de ejemplo'}</div><div class="price" data-testid="total">${money(total())}</div></div>`}${button(label,action,'primary',opts.disabled?'disabled':'')}</div></div>`;
  }
  function receipt(list=items()) {
    return `<div class="receipt"><span>Productos · ${units(list)} ${units(list)===1?'unidad':'unidades'}</span><b>${money(subtotal(list))}</b>${stores(list).map(store=>`<span>${shippingLabel(store)} · ${esc(store)}</span><b>${money(delivery[store]==='home'?4:0)}</b>`).join('')}<span class="total">Total de ejemplo</span><b class="total">${money(total(list))}</b></div>`;
  }
  function credits(p) { return `<div class="credits">Fotografía: ${p.photos.map(ph=>`<a href="${ph.url}" target="_blank" rel="noopener">${esc(ph.author)}</a>, <a href="${ph.licenseUrl}" target="_blank" rel="noopener">${esc(ph.license)}</a>`).join(' · ')}. Tamaño y formato adaptados. Producto e importes de exhibición.</div>`; }
  function favorite(p) { return button(icon('heart'),`favorite:${p.id}`,'card-favorite'+(saved.has(p.id)?' saved':''),`aria-label="${saved.has(p.id)?'Quitar de':'Añadir a'} favoritos: ${esc(p.title)}" aria-pressed="${saved.has(p.id)}"`); }
  function card(p) {
    return `<article class="product-card" data-product="${p.id}">${button(`<div class="card-photo">${image(p)}</div><div class="card-info"><div class="card-title">${esc(p.title)}</div><div class="card-price money">${money(p.price)}</div><div class="small muted">${esc(p.variant)}</div></div>`,`product:${p.id}`,'card-open',`aria-label="Ver ${esc(p.title)}"`)}${favorite(p)}${button(`<span>${cart.some(l=>l.id===p.id)?'En tu carrito':'Agregar al carrito'}</span>${icon('plus')}`,`add:${p.id}`,'card-add',`aria-label="Agregar ${esc(p.title)} al carrito"`)}</article>`;
  }
  function searchBox() { return `<label class="searchbox">${icon('search')}<input id="catalog-search" name="query" type="search" placeholder="Buscar productos o marcas" aria-label="Buscar productos o marcas" value="${esc(query)}" autocomplete="off"></label>`; }
  function catalog(home=false) {
    const cards=CATALOG.filter(p=>(!query||`${p.title} ${p.brand}`.toLowerCase().includes(query.toLowerCase()))&&(category==='Todo'||p.category===category)&&(!lowPrice||p.price<=25));
    if(sort==='low')cards.sort((a,b)=>a.price-b.price);if(sort==='high')cards.sort((a,b)=>b.price-a.price);
    const brand=`<div class="topbar"><div class="grow wordmark">hayazgo<span class="brand-dot">.</span></div>${ib('heart','Ver favoritos','favorites')}${button(`${icon('shopping-bag')}${units(cart)?`<span class="cart-count">${units(cart)}</span>`:''}`,'cart','icon-btn relative','aria-label="Ver carrito"')}</div>${searchBox()}`;
    const categories=`<div class="categories" aria-label="Tipos de producto">${['Todo','Carga','Conectividad','Energía'].map(c=>button(c,`category:${c}`,category===c?'active':'',`aria-pressed="${category===c}"`)).join('')}</div>`;
    const editorial=`<section class="home-editorial"><div><p>TECNOLOGÍA PARA TU DÍA</p><h2>Conecta.<br>Carga. Continúa.</h2>${button(`Explorar tecnología ${icon('arrow-right')}`,'catalog','')}</div>${image(CATALOG[0])}</section>`;
    $('#header').innerHTML=home?`<div class="home-masthead">${brand}</div>`:brand;
    return [home?`<div class="home-masthead">${editorial}</div>${categories}<div class="home-heading"><h2>Para tu día a día</h2>${button('Ver todo','catalog','')}</div>`+`<div class="grid">${cards.map(card).join('')}</div>`:`${categories}<div class="catalog-tools"><span>${cards.length} productos${lowPrice?' · Hasta $25':''}</span><div class="row">${button(`${icon('sliders-horizontal')} Filtrar`,'filter','')}${button(`${icon('arrow-up-down')} ${sort==='relevance'?'Ordenar':sort==='low'?'Menor precio':'Mayor precio'}`,'sort','')}</div></div>${cards.length?`<div class="grid">${cards.map(card).join('')}</div>`:empty('search','No encontramos coincidencias','Prueba otra palabra o elimina los filtros.','Limpiar búsqueda','reset-search')}`,navigation(home?'home':'catalog')];
  }
  function empty(ic,title,body,label,action) { return `<div class="empty">${icon(ic)}<h2>${title}</h2><p>${body}</p>${button(label,action)}</div>`; }
  function product() {
    const p=CATALOG[productId];
    $('#header').innerHTML=header('Producto',0,ib('heart',saved.has(p.id)?'Quitar de favoritos':'Añadir a favoritos',`favorite:${p.id}`,`aria-pressed="${saved.has(p.id)}"`));
    return [`<div class="gallery">${image(p,'',photo)}${p.photos.length>1?button(`${photo+1} / ${p.photos.length} ${icon('chevron-right')}`,'next-photo','gallery-index','aria-label="Ver siguiente fotografía"'):''}</div><section class="product-intro"><div class="product-brand">${esc(p.brand)}</div><h1>${esc(p.title)}</h1><div class="price">${money(p.price)}</div><p class="small muted">Precio de ejemplo · Venta por ${esc(p.store)}</p><div class="product-option">Presentación seleccionada<br><span class="option-chip" style="display:inline-flex;align-items:center">${esc(p.variant)}</span></div></section><div class="detail-line">${icon('truck')}<div class="grow">Entrega en ${address==='Casa'?'Chacao':'Altamira'}<small>Modalidades y costo al revisar tu compra.</small></div>${button('Cambiar','address','link')}</div><div class="detail-line">${icon('store')}<div class="grow">Vendido por ${esc(p.store)}<small>Una de las tiendas de este catálogo de ejemplo.</small></div></div><details><summary class="detail-toggle">Información del producto ${icon('chevron-down')}</summary><div class="details-body">${esc(p.title)}. ${esc(p.variant)}. Consulta compatibilidad, contenido y condiciones antes de comprar. Esta es una referencia de exhibición, sin una oferta real.</div></details>${credits(p)}`,`<div class="action-dock product-actions">${button('Agregar al carrito',`add:${p.id}`,'secondary')}${button('Ver mi carrito','cart')}</div>`];
  }
  function cartView() {
    $('#header').innerHTML=header(`Carrito <span class="muted" style="font-size:14px">(${units(cart)})</span>`,0,ib('heart','Ver favoritos','favorites'));
    if(!cart.length)return [empty('shopping-bag','Tu carrito está vacío','Explora productos y guarda aquí lo que te interesa.','Explorar productos','catalog'),navigation('cart')];
    const content=`<div class="delivery-bar">${icon('map-pin')} Entrega en <strong>${address==='Casa'?'Chacao':'Altamira'}</strong>${button('Cambiar','address','')}</div>`+stores(cart).map((store,index)=>`<section class="cart-group"><div class="seller-head">${icon('store')}${esc(store)}<small>Entrega ${index+1} de ${stores(cart).length}</small></div>${cart.filter(l=>CATALOG[l.id].store===store).map(l=>{const p=CATALOG[l.id];return `<div class="cart-product" data-testid="cart-product">${button(image(p,'cart-photo'),`product:${p.id}`,'',`aria-label="Ver ${esc(p.title)}" style="padding:0;flex-shrink:0"`)}<div class="grow"><h2>${esc(p.title)}</h2><p class="small muted">${esc(p.variant)}</p><div class="price">${money(p.price*l.qty)}</div><div class="quantity-row"><div class="quantity" aria-label="Cantidad de ${esc(p.title)}">${ib('minus',`Reducir cantidad de ${p.title}`,`minus:${p.id}`,l.qty===1?'disabled':'')}<span aria-live="polite">${l.qty}</span>${ib('plus',`Aumentar cantidad de ${p.title}`,`plus:${p.id}`,l.qty>=5?'disabled':'')}</div>${button(icon('trash'),`remove:${p.id}`,'remove',`aria-label="Eliminar ${esc(p.title)}"`)}</div></div></div>`;}).join('')}<div class="shipment-line">${icon('truck')}${shippingLabel(store)} · estimado<b>${money(delivery[store]==='home'?4:0)}</b></div></section>`).join('')+`<section class="cart-summary">${receipt(cart)}</section><p class="quiet-note">Tus tiendas envían por separado. Revisarás las modalidades y el total antes de crear el pedido.</p>`;
    return [content,dock('Continuar','delivery',{caption:'Total estimado'})+navigation('cart')];
  }
  function addressRow() { return button(`${icon('map-pin')}<span class="grow"><strong>${address} · Ana Ejemplo</strong><span class="small">${address==='Casa'?'Av. de ejemplo, Chacao':'Calle de ejemplo, Altamira'} · Caracas<br>Dirección ficticia para este prototipo.</span></span><span class="change">Cambiar</span>`,'address','address'); }
  function deliveryView() {
    $('#header').innerHTML=header('Entrega',1);
    return [addressRow()+stores().map((store,i)=>`<section class="fulfillment"><div class="fulfillment-head">${icon('store')}${esc(store)}<small>Entrega ${i+1} de ${stores().length}</small></div>${items().filter(l=>CATALOG[l.id].store===store).map(l=>`<div class="mini-product">${image(CATALOG[l.id])}<div class="grow">${esc(CATALOG[l.id].title)}<div class="small muted">${l.qty} ${l.qty===1?'unidad':'unidades'}</div></div></div>`).join('')}${button(`${icon('truck')}<span class="grow"><strong>${shippingLabel(store)}</strong><span class="small">${delivery[store]==='home'?'Estimado 16–19 oct. · ejemplo':'Punto de retiro de ejemplo'}</span></span><span class="money">${money(delivery[store]==='home'?4:0)}</span>${icon('chevron-down')}`,`shipping:${store}`,'shipping-option',`aria-label="Cambiar modalidad de ${esc(store)}"`)}</section>`).join('')+`<p class="quiet-note">Una dirección para el pedido. Cada tienda tiene su propia entrega y costo.</p>`,dock('Revisar pedido','review',{caption:'Total estimado'})];
  }
  function reviewView() {
    $('#header').innerHTML=header('Revisar pedido',2);
    return [addressRow()+`<section class="section"><div class="section-label"><h2>${stores().length} entregas</h2>${button('Editar','delivery','link')}</div>${stores().map(store=>`<div class="row between small" style="margin-top:14px"><strong>${esc(store)}</strong><span class="muted">${shippingLabel(store)} · ${money(delivery[store]==='home'?4:0)}</span></div>${items().filter(l=>CATALOG[l.id].store===store).map(l=>`<div class="review-line">${image(CATALOG[l.id])}<div class="grow">${esc(CATALOG[l.id].title)}<span class="small">${esc(CATALOG[l.id].variant)} · ${l.qty} ud.</span></div><b class="money">${money(CATALOG[l.id].price*l.qty)}</b></div>`).join('')}`).join('')}</section><section class="section"><div class="section-label"><h2>Resumen</h2><span class="small muted">Pago completo</span></div>${receipt()}</section><p class="quiet-note">Este escenario mixto no admite cuotas. Las condiciones del pedido se muestran antes de confirmar.</p>`,dock('Crear pedido','create',{caption:'Total del pedido',commitment:'Al crear el pedido se apartan los productos y se vacía el carrito. Después eliges cómo pagar. Aún no realizas ningún pago.'})];
  }
  const methods=[['pago_movil','smartphone','Pago Móvil','En bolívares · referencia bancaria'],['transferencia_ves','landmark','Transferencia bancaria','En bolívares · referencia bancaria'],['efectivo_usd','banknote','Efectivo en USD','Según instrucciones del pedido']];
  function methodView() {
    $('#header').innerHTML=header('Método de pago',3,button('Ver pedido','order','link'));
    return [`<div class="order-context"><span>Pedido de ejemplo <strong>EJ-1042</strong></span><span class="pill">Pendiente de pago</span></div><div class="section"><h2>¿Cómo vas a pagar?</h2><p class="small muted" style="margin-top:5px">El pedido está creado. Elige el método para ver sus instrucciones.</p></div><div role="radiogroup" aria-label="Método de pago">${methods.map(([id,ic,label,desc])=>`<label class="radio-row ${method===id?'selected':''}"><input type="radio" name="method" value="${id}" ${method===id?'checked':''}>${icon(ic)}<span class="grow"><strong>${label}</strong><small>${desc}</small></span></label>`).join('')}</div>`,dock('Ver instrucciones','payment',{caption:'Base de ejemplo'})];
  }
  function paymentView() {
    const cash=method==='efectivo_usd';
    $('#header').innerHTML=header(methods.find(m=>m[0]===method)[2],3,button('Cambiar','method','link'));
    if(reported) return [empty('clock','Tu pago sigue en verificación','Ya enviaste el reporte de ejemplo. No hace falta enviarlo de nuevo.','Ver estado del pedido','order'),''];
    return [`<div class="order-context"><span>Pedido <strong>EJ-1042</strong></span><span class="pill">Por pagar</span></div><div class="quote-amount"><span class="small muted">Monto de ejemplo · NO transfieras</span><div class="price">${cash?money(total()):money(total()*877.9,'VES')}</div><p>Base ${money(total())}${cash?'':' · Conversión de ejemplo 877,90 Bs/USD'}</p>${button('Referencia histórica del 14 oct.','rate','link')}</div>${cash?`<section class="section"><h2>Pago presencial</h2><p class="small muted" style="margin-top:8px">En una compra real, sigue el punto y las instrucciones indicadas en tu pedido. Este prototipo no coordina cobros.</p></section>`:`<dl class="bank-details"><dt>Banco</dt><dd>Banco de ejemplo · no operativo</dd><dt>Titular</dt><dd>HAYAZGO · dato ficticio</dd><dt>${method==='pago_movil'?'Teléfono':'Cuenta'}</dt><dd>${method==='pago_movil'?'0000 000 0000':'0000 0000 00 0000000000'}</dd><dt>Documento</dt><dd>J-00000000-0 · ficticio</dd></dl>`}<section class="payment-form"><h2>${cash?'Registrar entrega de efectivo':'Después de transferir'}</h2><label class="field">${cash?'Referencia (opcional)':'Referencia bancaria'}<input id="reference" name="reference" value="${esc(reference)}" inputmode="text" autocomplete="off" ${cash?'':'required minlength="6"'} placeholder="${cash?'Puedes dejarla vacía':'Escribe al menos 6 caracteres de ejemplo'}"><small>${cash?'No se registra un cobro real.':'Datos ficticios. No escribas claves ni información bancaria real.'}</small></label><label class="upload">${icon('upload')}<span id="attachment-name">${attachment?esc(attachment):'Adjuntar comprobante de ejemplo (opcional)'}</span><input type="file" id="attachment" accept="image/*" aria-label="Elegir comprobante de ejemplo"></label><p class="payment-note">Al enviar, el pago queda en verificación. El reporte y el comprobante por sí solos no confirman el pago.</p></section>`,dock(busy?'Enviando ejemplo…':'Enviar a verificación','report',{noTotal:true,disabled:busy||(!cash&&reference.trim().length<6)})];
  }
  function orderView() {
    $('#header').innerHTML=header('Pedido EJ-1042',0,button('Explorar','catalog','link'));
    return [`<section class="status-panel">${icon(reported?'clock':'shopping-bag')}<h1>${reported?'Pago en verificación':'Pedido pendiente de pago'}</h1><p>${reported?'El reporte de ejemplo se recibió. Aún no hay un pago confirmado. Conservas el detalle y el seguimiento.':'Los productos están apartados en este escenario. Revisa el método para continuar con el pago.'}</p></section><section class="section"><div class="section-label"><h2>Tu compra</h2><span class="money">${money(total(ordered))}</span></div>${ordered.map(l=>`<div class="review-line">${image(CATALOG[l.id])}<div class="grow">${esc(CATALOG[l.id].title)}<span class="small">${l.qty} ud. · ${esc(CATALOG[l.id].store)}</span></div><b>${money(CATALOG[l.id].price*l.qty)}</b></div>`).join('')}</section><section class="timeline"><div class="row">${icon('circle-check')}<div><h3>Pedido creado</h3><p class="small muted">Simulación local · sin reserva real.</p></div></div><div class="row">${icon(reported?'clock':'wallet')}<div><h3>${reported?'Reporte recibido':'Pago pendiente'}</h3><p class="small muted">${reported?'En revisión; no confirmado.':'Puedes retomar las instrucciones de pago.'}</p></div></div><div class="row">${icon('package')}<div><h3 class="muted">Preparación y entrega</h3><p class="small muted">Después de la confirmación correspondiente.</p></div></div></section>`,reported?`<div class="action-dock">${button('Seguir explorando','catalog','primary full')}</div>`:dock('Continuar con el pago','method',{caption:'Pendiente de ejemplo'})];
  }
  function accountView() {
    $('#header').innerHTML=header('Cuenta');
    return [`<section class="section"><h2>Tu espacio de compra</h2><p class="small muted" style="margin-top:5px">Perfil de ejemplo. No hay una sesión real.</p></section>${button(`${icon('package')}<span class="grow">${created?'Ver mi pedido de ejemplo':'Mis pedidos'}</span>${icon('chevron-right')}`,'my-orders','list-row')}${button(`${icon('heart')}<span class="grow">Favoritos <span class="muted">(${saved.size})</span></span>${icon('chevron-right')}`,'favorites','list-row')}${button(`${icon('moon')}<span class="grow">Apariencia: ${theme==='dark'?'oscuro':'claro'}</span>${icon('chevron-right')}`,'theme','list-row')}<p class="quiet-note">El vendedor conserva su espacio actual. Esta propuesta se concentra en el recorrido del comprador.</p>`,navigation('account')];
  }
  function render(keepScroll=false) {
    const oldScroll=$('#main').scrollTop;
    const focusAction=document.activeElement?.dataset?.action;
    document.documentElement.dataset.theme=theme;
    if(created&&!cart.length&&['delivery','review'].includes(screen)) {
      screen='order';history.replaceState({screen},'','#order');
    }
    if(!created&&['method','payment','order'].includes(screen)) {
      $('#header').innerHTML=header('Tu pedido');
      $('#main').innerHTML=empty('shopping-bag','Aún no hay un pedido','Revisa tu carrito y crea un pedido de ejemplo para recorrer el pago.','Ver carrito','cart');
      $('#footer').innerHTML=navigation('cart');return;
    }
    let view;
    if(['home','catalog'].includes(screen)) view=catalog(screen==='home');
    else if(screen==='product') view=product();
    else if(screen==='cart') view=cartView();
    else if(screen==='delivery') view=deliveryView();
    else if(screen==='review') view=reviewView();
    else if(screen==='method') view=methodView();
    else if(screen==='payment') view=paymentView();
    else if(screen==='order') view=orderView();
    else if(screen==='account') view=accountView();
    else if(screen==='favorites') { $('#header').innerHTML=header('Favoritos'); view=[saved.size?`<div class="home-heading"><h2>${saved.size} guardados</h2></div><div class="grid">${CATALOG.filter(p=>saved.has(p.id)).map(card).join('')}</div>`:empty('heart','Guarda lo que te gusta','Toca el corazón de un producto para encontrarlo aquí.','Explorar productos','catalog'),navigation('account')]; }
    else {screen='cart';render();return;}
    $('#main').innerHTML=view[0];$('#footer').innerHTML=view[1];
    $('#main').scrollTop=keepScroll?oldScroll:0;
    if(focusAction) $(`[data-action="${CSS.escape(focusAction)}"]`)?.focus({preventScroll:true});
    document.title=`HAYAZGO · ${{home:'Inicio',catalog:'Buscar',product:'Producto',cart:'Carrito',delivery:'Entrega',review:'Revisar pedido',method:'Método de pago',payment:'Reportar pago',order:'Pedido',account:'Cuenta',favorites:'Favoritos'}[screen]}`;
  }
  function addressSheet() { sheet('Dirección de entrega',`<p class="muted">Una dirección para todas las entregas. Solo datos de ejemplo.</p><div class="sheet-options">${['Casa','Oficina'].map(a=>button(`${icon('map-pin')}<span class="grow"><strong>${a} · Ana Ejemplo</strong><small>${a==='Casa'?'Chacao':'Altamira'} · Caracas · dirección ficticia</small></span>${address===a?icon('check'):''}`,`address-select:${a}`,'sheet-choice',`aria-pressed="${address===a}"`)).join('')}</div>`); }
  function createOrder() {
    if(created) return go('method');
    ordered=cart.map(l=>({...l}));cart=[];created=true;go('method');
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-action]');if(!target||target.disabled)return;
    const [action,arg]=target.dataset.action.split(':');
    if(['home','catalog','cart','delivery','review','method','payment','order','account','favorites'].includes(action)) {
      if(['delivery','review'].includes(action)&&!cart.length) {toast('Primero agrega un producto.');return go('catalog');}
      go(action);if(action==='catalog')setTimeout(()=>$('#catalog-search')?.focus(),0);return;
    }
    if(action==='close')return closeSheet();
    if(action==='back')return back();
    if(action==='product'){productId=Number(arg);photo=0;return go('product');}
    if(action==='next-photo'){photo=(photo+1)%CATALOG[productId].photos.length;return render(true);}
    if(action==='favorite'){const id=Number(arg);saved.has(id)?saved.delete(id):saved.add(id);render(true);toast(saved.has(id)?'Guardado en favoritos':'Quitado de favoritos');return;}
    if(action==='add'){const id=Number(arg),line=cart.find(l=>l.id===id);if(line?.qty>=5)return toast('Límite de 5 unidades en este ejemplo.');if(line)line.qty++;else cart.push({id,qty:1});render(true);toast('Producto agregado al carrito');return;}
    if(action==='plus'||action==='minus'){const line=cart.find(l=>l.id===Number(arg));if(line)line.qty=Math.max(1,Math.min(5,line.qty+(action==='plus'?1:-1)));render(true);return;}
    if(action==='remove'){const p=CATALOG[Number(arg)];return sheet('¿Quitar este producto?',`<div class="mini-product">${image(p)}<strong>${esc(p.title)}</strong></div><p class="muted">Puedes volver a agregarlo desde el catálogo.</p><div class="row" style="margin-top:16px">${button('Conservar','close','secondary full')}${button('Quitar',`confirm-remove:${arg}`,'primary full')}</div>`);}
    if(action==='confirm-remove'){cart=cart.filter(l=>l.id!==Number(arg));closeSheet();render(true);return toast('Producto quitado del carrito');}
    if(action==='address')return addressSheet();
    if(action==='address-select'){address=arg;closeSheet();render(true);return toast('Dirección de ejemplo actualizada');}
    if(action==='shipping')return sheet(`Entrega de ${esc(arg)}`,`<p class="muted">Modalidades y costos ficticios para comparar el diseño.</p><div class="sheet-options">${[['home','truck','A domicilio','$4,00'],['pickup','store','Retiro en tienda','$0,00']].map(([id,ic,title,cost])=>button(`${icon(ic)}<span class="grow"><strong>${title}</strong><small>${id==='home'?'Estimado 16–19 oct. · ejemplo':'Punto de retiro de ejemplo'}</small></span><b>${cost}</b>`,`shipping-select:${arg}|${id}`,'sheet-choice',`aria-pressed="${delivery[arg]===id}"`)).join('')}</div>`);
    if(action==='shipping-select'){const [store,id]=arg.split('|');delivery[store]=id;closeSheet();render(true);return toast('Modalidad de ejemplo actualizada');}
    if(action==='create')return createOrder();
    if(action==='sort')return sheet('Ordenar productos',`<div class="sheet-options">${[['relevance','Recomendados'],['low','Menor precio'],['high','Mayor precio']].map(([id,label])=>button(`<span class="grow">${label}</span>${sort===id?icon('check'):''}`,`sort-select:${id}`,'sheet-choice',`aria-pressed="${sort===id}"`)).join('')}</div>`);
    if(action==='sort-select'){sort=arg;closeSheet();render();return toast('Orden actualizado');}
    if(action==='filter')return sheet('Filtrar productos',`<h3>Precio de ejemplo</h3><div class="sheet-options">${button('Todos los precios','price-all','sheet-choice',`aria-pressed="${!lowPrice}"`)}${button('Hasta $25','price-low','sheet-choice',`aria-pressed="${lowPrice}"`)}</div><p class="small muted" style="margin-top:16px">Este catálogo de diseño contiene cinco referencias. Las capacidades de filtrado de la app se conservan.</p>`);
    if(action==='price-all'||action==='price-low'){lowPrice=action==='price-low';closeSheet();render();return;}
    if(action==='category'){category=arg;render();return;}
    if(action==='reset-search'){query='';lowPrice=false;category='Todo';render();return;}
    if(action==='rate')return sheet('Referencia de conversión',`<p>El ejemplo utiliza <strong>877,90 Bs/USD</strong>, referencia histórica del 14 de octubre de 2026.</p><p class="muted" style="margin-top:12px">No es una cotización vigente y no debe usarse para transferir. En una compra real, revisa el monto, la fuente y la vigencia indicados para tu pago.</p>${button('Entendido','close','primary full')}`);
    if(action==='report'){if(busy||reported)return;if(method!=='efectivo_usd'&&reference.trim().length<6)return $('#reference').focus();busy=true;render(true);setTimeout(()=>{busy=false;reported=true;go('order');toast('Reporte de ejemplo recibido; pago sin confirmar');},650);return;}
    if(action==='my-orders'){if(created)return go('order');return sheet('Mis pedidos',`<p>No has creado un pedido en esta simulación. Tu historial real no se consulta.</p>${button('Explorar productos','catalog','primary full')}`);}
    if(action==='theme'){theme=theme==='dark'?'light':'dark';return render(true);}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='catalog-search') {query=e.target.value;const pos=e.target.selectionStart;render();const input=$('#catalog-search');input.focus({preventScroll:true});try{input.setSelectionRange(pos,pos);}catch{}}
    if(e.target.id==='reference') {reference=e.target.value;const report=$('[data-action="report"]');report.disabled=busy||(method!=='efectivo_usd'&&reference.trim().length<6);}
  });
  document.addEventListener('change',e=>{
    if(e.target.name==='method'){method=e.target.value;reference='';attachment='';render(true);}
    if(e.target.id==='attachment'){attachment=e.target.files[0]?.name||'';$('#attachment-name').textContent=attachment||'Adjuntar comprobante de ejemplo (opcional)';}
  });
  render();
})();
