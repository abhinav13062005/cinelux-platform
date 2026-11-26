import { getStore } from "@netlify/blobs";
const MOVIE="Ruff and Tuff Kanya", DATE="2026-11-26", TIME="17:00";
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export default async req=>{
 if(req.method!=="POST")return reply({error:"POST only"},405);
 let b;try{b=await req.json()}catch{return reply({error:"Invalid JSON"},400)}
 const pin=process.env.STAFF_PIN;if(!pin)return reply({error:"Server setup incomplete: add STAFF_PIN in Netlify environment variables and redeploy."},503);
 if(String(b.pin||"")!==pin)return reply({error:"Wrong PIN"},401);
 try{
  const store=getStore("cinelux-tickets");
  const all=async()=>{let cursor,items=[];do{const page=await store.list({cursor,limit:1000});const vals=await Promise.all(page.blobs.map(x=>store.get(x.key,{type:"json"})));items.push(...vals.filter(Boolean));cursor=page.cursor}while(cursor);return items.sort((a,b)=>(a.issuedAt||0)-(b.issuedAt||0))};
  if(b.op==="list")return reply({tickets:await all()});
  if(b.op==="create"){
   const name=String(b.name||"").trim().slice(0,60),phone=String(b.phone||"").replace(/\D/g,""),seat=String(b.seat||"").trim().toUpperCase().slice(0,12),members=Math.max(1,Math.min(20,parseInt(b.members,10)||1));
   if(!name||!/^\d{10}$/.test(phone)||!seat)return reply({error:"Enter client name, valid 10-digit WhatsApp number and seat."},400);
   if((await all()).some(t=>t.seat===seat))return reply({error:"Seat "+seat+" is already issued."},409);
   const alphabet="ABCDEFGHJKMNPQRSTUVWXYZ23456789",bytes=crypto.getRandomValues(new Uint8Array(14)),code=Array.from(bytes,n=>alphabet[n%alphabet.length]).join("").slice(0,8)+"-"+Array.from(bytes.slice(8),n=>alphabet[n%alphabet.length]).join("");
   const ticket={code,movie:MOVIE,date:DATE,time:TIME,name,phone,seat,members,issuedAt:Date.now(),usedAt:null};await store.setJSON(code,ticket);return reply({ticket});
  }
  if(b.op==="checkin"){
   const code=String(b.code||"").trim().toUpperCase(),ticket=await store.get(code,{type:"json"});if(!ticket)return reply({status:"invalid"});if(ticket.date!==DATE||ticket.time!==TIME)return reply({status:"wrong",ticket});if(ticket.usedAt)return reply({status:"used",ticket});ticket.usedAt=Date.now();await store.setJSON(code,ticket);return reply({status:"ok",ticket});
  }
  return reply({error:"Unknown operation"},400);
 }catch(e){console.error("Cinelux API",e);return reply({error:"Ticket service error. Check Netlify Function logs."},500)}
};
export const config={path:"/api"};
