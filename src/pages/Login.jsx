import { useState } from "react";
import { Btn, Inp, Lbl, ThemeToggle } from "../components/ui/index.jsx";
import { supabase } from "../lib/supabase.js";

const Login=({onLogin,isDark,toggleTheme})=>{
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [err,setErr]=useState("");const [loading,setLoading]=useState(false);

  const submit=async()=>{
    if(!email||!pass)return setErr("Enter email and password");
    setLoading(true);setErr("");
    try{
      const{data,error}=await supabase.auth.signInWithPassword({email,password:pass});
      if(error){setErr(error.message||"Invalid email or password.");setLoading(false);return;}
      const{data:profile,error:pe}=await supabase.from("users").select("*,holidays!holidays_user_id_fkey(*)").eq("id",data.user.id).maybeSingle();
      if(pe||!profile){setErr("Profile not found. Contact admin.");setLoading(false);return;}
      onLogin(profile);
    }catch(e){
      console.error("Login error:",e);
      setErr("Login failed. Please try again.");
      setLoading(false);
    }
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(var(--bdr) 1px,transparent 1px),linear-gradient(90deg,var(--bdr) 1px,transparent 1px)",backgroundSize:"40px 40px",opacity:.15}}/>
      <div style={{position:"absolute",top:16,right:16}}><ThemeToggle isDark={isDark} toggle={toggleTheme}/></div>
      <div style={{width:"100%",maxWidth:400,position:"relative",animation:"fadeUp .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:32,height:32,background:"var(--acc)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:16,fontFamily:"IBM Plex Mono",fontWeight:700,color:"#fff"}}>E</span></div><span style={{fontSize:20,fontWeight:900,letterSpacing:"-0.02em",fontFamily:"IBM Plex Mono",color:"var(--txt)"}}>ELECBITS</span></div>
          <div style={{fontSize:10,color:"var(--txt2)",fontFamily:"IBM Plex Mono",letterSpacing:"0.1em",textTransform:"uppercase"}}>Project Management System v9</div>
        </div>
        <div className="card" style={{padding:24}}>
          <div style={{marginBottom:12}}><Lbl>Email</Lbl><Inp type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@elecbits.in" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          <div style={{marginBottom:18}}><Lbl>Password</Lbl><Inp type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          {err&&<div style={{color:"var(--red)",fontSize:12,marginBottom:12,padding:"7px 10px",background:"var(--red)12",borderRadius:5,border:"1px solid var(--red)30"}}>{err}</div>}
          <Btn onClick={submit} style={{width:"100%",justifyContent:"center",padding:9}} disabled={loading}>{loading?<span style={{width:13,height:13,border:"2px solid #ffffff40",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>:"Sign In →"}</Btn>
        </div>
      </div>
    </div>
  );
};

export default Login;
