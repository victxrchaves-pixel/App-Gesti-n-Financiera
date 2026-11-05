import { useState } from 'react';
import { SERVICIOS, identificarServicio } from '../lib/services';
import { Icon } from './Icon';
const ICONOS = new Set(["icloud", "youtube", "googledrive", "figma", "claude", "netflix", "notion", "github", "spotify", "dropbox"]);
export function ServiceIcon({ id, nombre }: { id?:string|null; nombre:string }) {
  const servicio = SERVICIOS.find(s=>s.id===id) ?? identificarServicio(nombre); const [fallo,setFallo]=useState(false);
  return <span className="service-icon" aria-hidden="true">{servicio&&ICONOS.has(servicio.icono)&&!fallo?<img src={`${import.meta.env.BASE_URL}icons/services/${servicio.icono}.svg`} alt="" onError={()=>setFallo(true)} />:servicio?.grupo==='Cloud'?<Icon name="cloud" size={28}/>:<span>{nombre.slice(0,2).toUpperCase()}</span>}</span>;
}
