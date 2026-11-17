'use client';
import Link from 'next/link';
import { House, Search, ShoppingBag, UserRound } from 'lucide-react';
const destinations=[{href:'/',label:'Inicio',Icon:House},{href:'/buscar',label:'Buscar',Icon:Search},{href:'/carrito',label:'Carrito',Icon:ShoppingBag},{href:'/cuenta',label:'Cuenta',Icon:UserRound}];
export function MobileNavigation({pathname,cartUnits,cartKnown}:{pathname:string;cartUnits:number;cartKnown:boolean}) {
  return <nav className="mobile-navigation" aria-label="Navegación principal">
    {destinations.map(({href,label,Icon})=>{
      const current=pathname===href;
      const account=href==='/cuenta'&&['/pedidos','/direcciones','/favoritos','/notificaciones'].some(route=>pathname===route||pathname.startsWith(route+'/'));
      const isCart=href==='/carrito';
      return <Link key={href} prefetch={false} href={href} aria-current={current?'page':account?'location':undefined} data-active={current||account?true:undefined} aria-label={isCart&&cartKnown?`Carrito, ${cartUnits} ${cartUnits===1?'unidad':'unidades'}`:label} onClick={event=>{if(current && event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)event.preventDefault();}}>
        <span className="mobile-navigation-icon"><Icon size={23} aria-hidden="true"/>{isCart&&cartKnown&&cartUnits>0&&<b className="mobile-navigation-count" aria-hidden="true">{cartUnits>99?'99+':cartUnits}</b>}</span>
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
