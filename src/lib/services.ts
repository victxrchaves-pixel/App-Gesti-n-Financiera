export const SERVICIOS = [
  { id:'icloud', nombre:'iCloud+', categoria:'Cloud', grupo:'Cloud', icono:'icloud' },
  { id:'googleone', nombre:'Google One', categoria:'Cloud', grupo:'Cloud', icono:'googledrive' },
  { id:'dropbox', nombre:'Dropbox', categoria:'Cloud', grupo:'Cloud', icono:'dropbox' },
  { id:'microsoft365', nombre:'Microsoft 365', categoria:'Software', grupo:'Cloud', icono:'microsoft365' },
  { id:'netflix', nombre:'Netflix', categoria:'Entretenimiento', grupo:'Entretenimiento', icono:'netflix' },
  { id:'primevideo', nombre:'Prime Video', categoria:'Entretenimiento', grupo:'Entretenimiento', icono:'primevideo' },
  { id:'spotify', nombre:'Spotify', categoria:'Entretenimiento', grupo:'Entretenimiento', icono:'spotify' },
  { id:'youtube', nombre:'YouTube Premium', categoria:'Entretenimiento', grupo:'Entretenimiento', icono:'youtube' },
  { id:'adobe', nombre:'Adobe Creative Cloud', categoria:'Software', grupo:'Trabajo y diseño', icono:'adobe' },
  { id:'figma', nombre:'Figma', categoria:'Software', grupo:'Trabajo y diseño', icono:'figma' },
  { id:'notion', nombre:'Notion', categoria:'Software', grupo:'Trabajo y diseño', icono:'notion' },
  { id:'github', nombre:'GitHub', categoria:'Software', grupo:'Trabajo y diseño', icono:'github' },
  { id:'chatgpt', nombre:'ChatGPT', categoria:'Software', grupo:'Trabajo y diseño', icono:'openai' },
  { id:'claude', nombre:'Claude', categoria:'Software', grupo:'Trabajo y diseño', icono:'claude' },
] as const;
export function identificarServicio(nombre: string) {
  const normal = (s:string) => s.toLowerCase().replace(/[^a-z0-9]/g,'');
  return SERVICIOS.find(s => normal(s.nombre)===normal(nombre));
}
