import { avColors, getUser } from "../../lib/constants.jsx";

export const Av=({uid,size=30,users})=>{
  const u=getUser(uid,users||[]);
  const c=avColors[((uid||1)-1)%avColors.length];
  return <div style={{width:size,height:size,borderRadius:"50%",background:`${c}22`,border:`1.5px solid ${c}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,color:c,flexShrink:0,fontFamily:"IBM Plex Mono"}}>{u?.avatar||"?"}</div>;
};
export const Pill=({label,color,small,dot=true})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:small?"2px 7px":"3px 10px",borderRadius:99,fontSize:small?9:10,fontWeight:700,fontFamily:"IBM Plex Mono",letterSpacing:"0.04em",background:`${color||"var(--txt3)"}18`,color:color||"var(--txt2)",border:`1px solid ${color||"var(--txt3)"}40`,whiteSpace:"nowrap"}}>
    {dot&&<span style={{width:5,height:5,borderRadius:"50%",background:color||"var(--txt3)",flexShrink:0}}/>}{label}
  </span>
);
export const Tag=({label,color})=>(
  <span style={{padding:"1px 7px",borderRadius:3,fontSize:10,fontWeight:600,background:`${color||"var(--txt3)"}18`,color:color||"var(--txt3)",border:`1px solid ${color||"var(--txt3)"}35`,whiteSpace:"nowrap",fontFamily:"IBM Plex Mono"}}>{label}</span>
);
export const Bar=({val,color,thin})=>(
  <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{flex:1,height:thin?3:5,background:"var(--bdr)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${Math.max(0,Math.min(100,val||0))}%`,height:"100%",background:color||(val>=70?"var(--green)":val>=40?"var(--blue)":"var(--amber)"),borderRadius:99}}/></div>
    <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",fontFamily:"IBM Plex Mono",minWidth:26}}>{val||0}%</span>
  </div>
);
export const Inp=({style:s,...p})=>(
  <input {...p} className="inp-base" style={{...s}} onFocus={e=>e.target.style.borderColor="var(--acc)"} onBlur={e=>e.target.style.borderColor="var(--bdr)"}/>
);
export const Sel=({children,style:s,...p})=>(
  <select {...p} className="inp-base" style={{cursor:"pointer",...s}}>{children}</select>
);
export const TA=({style:s,...p})=>(
  <textarea {...p} className="inp-base" style={{resize:"vertical",...s}} onFocus={e=>e.target.style.borderColor="var(--acc)"} onBlur={e=>e.target.style.borderColor="var(--bdr)"}/>
);
export const Btn=({children,v="primary",style:s,...p})=>{
  const vs={primary:{background:"var(--acc)",color:"#fff",border:"none"},secondary:{background:"var(--s3)",color:"var(--txt)",border:"1px solid var(--bdr)"},danger:{background:"var(--red)",color:"#fff",border:"none"},ghost:{background:"transparent",color:"var(--acc)",border:"1px solid var(--bdr2)"},success:{background:"var(--green)",color:"#fff",border:"none"},amber:{background:"var(--amber)",color:"#fff",border:"none"},purple:{background:"var(--purple)",color:"#fff",border:"none"}};
  return <button {...p} style={{padding:"7px 14px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s",display:"inline-flex",alignItems:"center",gap:5,...vs[v],...s}}>{children}</button>;
};
export const Lbl=({children,style:s})=><div style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,fontFamily:"IBM Plex Mono",...s}}>{children}</div>;
export const Card=({children,style:s,onClick})=><div onClick={onClick} className="card" style={{...s}}>{children}</div>;
export const Divider=()=><div style={{height:1,background:"var(--bdr)",margin:"16px 0"}}/>;
export const SH=({title,action,color})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
    <div style={{fontSize:10,color:"var(--txt2)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",display:"flex",alignItems:"center",gap:8}}><span style={{width:3,height:14,background:color||"var(--acc)",borderRadius:2}}/>{title}</div>
    {action}
  </div>
);
export const Stat=({label,value,color,sub})=>(
  <Card style={{padding:"13px 16px"}}>
    <div style={{fontSize:10,color:"var(--txt2)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:5}}>{label}</div>
    <div style={{fontSize:24,fontWeight:800,color:color||"var(--txt)",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:"var(--txt2)",marginTop:3}}>{sub}</div>}
  </Card>
);
export const Modal=({title,children,onClose,wide,maxW})=>(
  <div style={{position:"fixed",inset:0,background:"#00000080",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="card" style={{width:"100%",maxWidth:maxW||(wide?940:520),maxHeight:"92vh",overflow:"auto",animation:"fadeUp .2s ease",boxShadow:"var(--shadow)"}}>
      <div style={{padding:"14px 20px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"var(--card)",zIndex:1}}>
        <span style={{fontSize:14,fontWeight:800,color:"var(--txt)"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--txt2)",cursor:"pointer",fontSize:20,padding:"0 6px",lineHeight:1}}>×</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>
);
export const Toast=({msg,color})=>msg?<div style={{position:"fixed",bottom:24,right:24,background:color||"var(--green)",color:"#fff",padding:"10px 18px",borderRadius:8,fontWeight:700,fontSize:12,zIndex:9999,animation:"fadeUp .2s ease",boxShadow:"var(--shadow)"}}>{msg}</div>:null;

export const ThemeToggle=({isDark,toggle})=>(
  <button onClick={toggle} style={{background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:20,padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--txt2)",transition:"all .2s"}}>
    <span style={{fontSize:14}}>{isDark?"☀":"🌙"}</span>
    <span style={{fontFamily:"IBM Plex Mono",fontWeight:600}}>{isDark?"Light":"Dark"}</span>
  </button>
);
