import type {ProductRow} from "../db/database";
export type CartLine={product:ProductRow;quantity:number};
export function addToCart(cart:CartLine[],p:ProductRow):CartLine[]{const old=cart.find(x=>x.product.id===p.id);const q=(old?.quantity??0)+1;if(q>p.stock)return cart;if(old)return cart.map(x=>x.product.id===p.id?{...x,quantity:q}:x);return [...cart,{product:p,quantity:1}];}
export function setCartQuantity(cart:CartLine[],id:number,q:number):CartLine[]{if(q<=0)return cart.filter(x=>x.product.id!==id);return cart.map(x=>x.product.id===id?{...x,quantity:Math.min(q,x.product.stock)}:x);}
export function calculateTotal(cart:CartLine[]):number{return Math.round(cart.reduce((s,x)=>s+x.product.price*x.quantity,0)*100)/100;}
