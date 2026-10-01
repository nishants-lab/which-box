export const runtime = {
  web:true,
  playLabel:'Play at '+location.origin+location.pathname,
  imageLabel:location.host+location.pathname,
  storage:{
    async get<T=unknown>(key:string):Promise<T>{const raw=localStorage.getItem('which-box:'+key);return (raw?JSON.parse(raw):null) as T;},
    async set(key:string,value:unknown):Promise<void>{localStorage.setItem('which-box:'+key,JSON.stringify(value));},
  },
  serve(_handlers:Record<string,()=>unknown>){},
  ready(){},
};
