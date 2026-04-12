import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { fetchClientsFromSheet, searchCompanyInfo, appendNewClientToDb } from "../lib/googleSheets.js";
import {
  searchClients, ClientDbError, preloadClientDb, isClientDbConfigured,
  clearClientDbCache, triggerSheetSync, appendNewClient, updateClientFields,
} from "../lib/clientsDb.js";
import { signInWithGoogle, isGoogleSignedIn, isGoogleConfigured, signOutGoogle } from "../lib/googleAuth.js";
import { searchDriveFiles, readDoc, createGoogleDoc } from "../lib/googleApi.js";
import { generateLLD, buildFallbackLLD } from "../lib/lldGenerator.js";
import { pushDirtyProjectsToSheet, getNextProjectCount } from "../lib/projectsDb.js";

/* ─── LLD QUESTIONS ──────────────────────────────────────────────*/
const LLD_QUESTIONS = [
  // Product Overview (Q1-5)
  { id:1,  tab:2, text:"What is the product you want to build? Describe it in one sentence.", hint:"This becomes the one-liner on every internal doc. Keep it tight.", type:"text" },
  { id:2,  tab:2, text:"What category does it fall into?", hint:"Helps us assign the right engineering team from the start.", type:"chips", chips:["Consumer Electronics","Industrial IoT","Medical Device","Automotive","Wearable","Smart Home","Agriculture","Robotics","Other"] },
  { id:3,  tab:2, text:"What problem does it solve for the end user?", hint:"The clearer the pain point, the better we can prioritise features.", type:"text" },
  { id:4,  tab:2, text:"Who is the target user?", hint:"Affects enclosure rating, UI complexity and compliance path.", type:"chips", chips:["B2B — Enterprise","B2B — SME","B2C — Consumer","B2G — Government","Internal use","Other"] },
  { id:5,  tab:2, text:"Are there any existing products or references you want us to study?", hint:"A reference product saves weeks of back-and-forth on specs.", type:"text" },

  // Functions (Q6-10)
  { id:6,  tab:3, text:"List the key features / functions this product must have.", hint:"These become the acceptance criteria for every milestone.", type:"text" },
  { id:7,  tab:3, text:"Which sensors or input devices are needed?", hint:"Sensor selection drives PCB size, power budget and BOM cost.", type:"text" },
  { id:8,  tab:3, text:"What outputs / actuators are required?", hint:"Motor drivers, relays, LEDs — all affect power architecture.", type:"chips", chips:["LEDs / Display","Motor / Actuator","Speaker / Buzzer","Relay","Solenoid","Heating element","Pump","None","Other"] },
  { id:9,  tab:3, text:"Does it need a user interface?", hint:"Determines if we need a display, buttons, or touch controller on the PCB.", type:"chips", chips:["Physical buttons only","LCD / OLED screen","Touchscreen","Mobile app only","Voice control","LED indicators only","No UI","Other"] },
  { id:10, tab:3, text:"Any special processing requirements (AI/ML, real-time, high-speed data)?", hint:"This decides the MCU/SoC tier — cost jumps significantly with AI.", type:"text" },

  // Connectivity (Q11-14)
  { id:11, tab:4, text:"What wireless connectivity is needed?", hint:"Each radio adds an antenna, cert path and power draw.", type:"text" },
  { id:12, tab:4, text:"Select all wireless protocols required:", hint:"Multi-protocol combos (e.g. Wi-Fi + BLE) need combo modules.", type:"chips", multi:true, chips:["Wi-Fi","Bluetooth / BLE","LoRa","Zigbee","Z-Wave","Cellular (4G/5G)","NFC","GPS","Thread","None"] },
  { id:13, tab:4, text:"Any wired interfaces needed?", hint:"Connector count affects enclosure sealing and cost.", type:"chips", chips:["USB-C","Ethernet","RS-485","CAN bus","UART / Serial","I2C / SPI (internal)","HDMI","Audio jack","None"] },
  { id:14, tab:4, text:"Does it need cloud connectivity or a backend?", hint:"Cloud integration adds firmware OTA, security certs and server costs.", type:"chips", chips:["Yes — custom cloud","Yes — AWS IoT","Yes — Azure IoT","Yes — Google Cloud","Yes — Elecbits platform","No cloud needed","TBD"] },

  // Power (Q15-18)
  { id:15, tab:5, text:"How will the device be powered?", hint:"Battery vs mains changes the entire power tree design.", type:"chips", chips:["Battery only","Mains (AC adapter)","USB powered","Solar","PoE","Battery + charging","Multiple sources","TBD"] },
  { id:16, tab:5, text:"If battery-powered, what is the expected battery life?", hint:"Drives sleep-mode firmware architecture and component selection.", type:"text" },
  { id:17, tab:5, text:"Any power consumption constraints or targets?", hint:"Thermal limits in sealed enclosures are a common late surprise.", type:"text" },
  { id:18, tab:5, text:"Does it need to support power-saving / sleep modes?", hint:"Deep-sleep firmware is non-trivial — better to plan early.", type:"chips", chips:["Yes — critical","Yes — nice to have","No — always on","TBD"] },

  // Software (Q19-21)
  { id:19, tab:6, text:"Is there a companion mobile or web app?", hint:"App development is often 40% of the project timeline.", type:"chips", chips:["Mobile app (iOS + Android)","Mobile app (Android only)","Mobile app (iOS only)","Web dashboard","Both mobile + web","No app needed","TBD"] },
  { id:20, tab:6, text:"Does the firmware need OTA (over-the-air) update capability?", hint:"OTA needs a bootloader, dual-partition flash and signing infra.", type:"chips", chips:["Yes — essential","Nice to have","No","TBD"] },
  { id:21, tab:6, text:"Any data logging, analytics or reporting requirements?", hint:"Determines on-device storage and cloud pipeline design.", type:"chips", chips:["Real-time telemetry","On-device logging","Cloud analytics dashboard","Exportable reports","Edge analytics","No data requirements","TBD"] },

  // Physical (Q22-24)
  { id:22, tab:7, text:"What are the approximate size constraints? (L × W × H in mm, or describe)", hint:"PCB dimensions are locked early — changes are expensive later.", type:"text" },
  { id:23, tab:7, text:"What environment will it operate in?", hint:"IP rating, conformal coating and connector selection depend on this.", type:"chips", chips:["Indoor — controlled","Indoor — dusty/humid","Outdoor — sheltered","Outdoor — exposed","Underwater","Hazardous / explosive","Wearable (on body)","Vehicle-mounted","Other"] },
  { id:24, tab:7, text:"Enclosure material preference?", hint:"Tooling cost varies 10x between 3D-print and injection mould.", type:"chips", chips:["Plastic (injection mould)","Metal (aluminium/steel)","3D printed (prototype)","Silicone / rubber","No enclosure (board only)","TBD"] },

  // Certs (Q25-26)
  { id:25, tab:8, text:"Select all required certifications:", hint:"Cert requirements lock certain design choices at schematic stage.", type:"chips", multi:true, chips:["CE","FCC","UL","BIS (India)","RoHS","REACH","IP rating","MIL-STD","IEC 60601 (Medical)","ISO 13485","Automotive (AEC-Q)","None yet","TBD"] },
  { id:26, tab:8, text:"Any regulatory or compliance notes we should know about?", hint:"Country-specific rules (e.g. India BIS) can add months.", type:"text" },

  // Cost & Time (Q27-30)
  { id:27, tab:9, text:"What is the target unit cost (BOM) range?", hint:"Sets the ceiling for component and PCB layer choices.", type:"chips", chips:["< ₹500","₹500 – ₹2,000","₹2,000 – ₹5,000","₹5,000 – ₹15,000","₹15,000+","No target yet"] },
  { id:28, tab:9, text:"Expected production volume in the first year?", hint:"Drives tooling investment and supplier MOQ negotiations.", type:"text" },
  { id:29, tab:9, text:"Any hard deadline or launch date we must hit?", hint:"If there is an expo, funding round or seasonal window — we need to know now.", type:"text" },
  { id:30, tab:9, text:"Anything else we should know? Special requests, risks, constraints…", hint:"The catch-all. Better to over-share than discover surprises later.", type:"text" },
];

const TABS = [
  { idx:0, label:"Client" },
  { idx:1, label:"Project" },
  { idx:2, label:"Product" },
  { idx:3, label:"Functions" },
  { idx:4, label:"Connectivity" },
  { idx:5, label:"Power" },
  { idx:6, label:"Software" },
  { idx:7, label:"Physical" },
  { idx:8, label:"Certs" },
  { idx:9, label:"Cost & Time" },
  { idx:10, label:"Review" },
];

const INDUSTRY_CODES = [
  { label:"Electric Vehicle", code:"01" },
  { label:"EMS", code:"02" },
  { label:"Just IoT", code:"03" },
  { label:"IIoT", code:"04" },
  { label:"Home Automation", code:"05" },
  { label:"Medical & Healthcare", code:"06" },
  { label:"Energy Meter & Metering", code:"07" },
  { label:"Wearables", code:"08" },
  { label:"Camera & Opticals", code:"09" },
  { label:"Agri Tech/Farm Tech/Food Tech", code:"10" },
  { label:"AR/VR/AI", code:"11" },
  { label:"Education-Tech/EdTech", code:"12" },
  { label:"Industrial/Machine Setup", code:"13" },
  { label:"ERP Solutions", code:"14" },
  { label:"Robotics", code:"15" },
  { label:"Information Technology", code:"16" },
  { label:"Defence/Military", code:"17" },
  { label:"Automotive", code:"18" },
  { label:"Battery Manufacturer", code:"19" },
  { label:"Consumer Electronics", code:"20" },
  { label:"Other", code:"21" },
  { label:"Government & Alliance", code:"22" },
  { label:"Freelance/Individual/Personal", code:"23" },
  { label:"Logistics/Fleet Management", code:"24" },
  { label:"Fintech", code:"25" },
  { label:"Aerospace", code:"26" },
  { label:"BLDC", code:"27" },
  { label:"Renewables", code:"28" },
  { label:"Oil & Gas", code:"29" },
  { label:"Smart Home", code:"30" },
  { label:"Research", code:"31" },
  { label:"E-Mobility", code:"32" },
  { label:"Infrastructure", code:"33" },
  { label:"Toys and Games", code:"34" },
  { label:"Incubator", code:"35" },
  { label:"Security/Surveillance", code:"36" },
  { label:"Electronics Components Manufacturing", code:"37" },
  { label:"Drone Tech", code:"38" },
  { label:"Solar", code:"39" },
  { label:"IT Hardware", code:"40" },
  { label:"Display Manufacturers", code:"41" },
  { label:"Industrial Applications", code:"42" },
];

const ORG_SIZES = [
  { label:"Proto Level — Small Hardware Startups", code:"PL" },
  { label:"Mid Level — Hardware Startups", code:"ML" },
  { label:"Enterprise Level — Large Product Companies", code:"EL" },
  { label:"EMS", code:"EM" },
  { label:"Individuals/Unknown", code:"UN" },
  { label:"Government Organisation", code:"GO" },
];

const UNIQ = () => Math.random().toString(36).slice(2, 9);

/* ─── STYLES ─────────────────────────────────────────────────────*/
const S = {
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(6px)" },
  modal: { width:"100%", maxWidth:940, maxHeight:"92vh", display:"flex", flexDirection:"column", borderRadius:12, overflow:"hidden", background:"#fff", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", animation:"fadeUp .2s ease" },
  header: { background:"linear-gradient(135deg, #1e3a8a, #2563eb)", padding:"16px 24px 0", flexShrink:0, borderRadius:"12px 12px 0 0" },
  headerTop: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  headerLeft: { display:"flex", alignItems:"center", gap:12 },
  ebAvatar: { width:36, height:36, borderRadius:8, background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff", fontFamily:"'IBM Plex Mono',monospace" },
  headerTitle: { fontSize:16, fontWeight:700, color:"#fff" },
  headerSub: { fontSize:11, color:"rgba(255,255,255,0.6)" },
  badge: { padding:"4px 10px", borderRadius:99, background:"rgba(255,255,255,0.15)", fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.8)" },
  closeBtn: { background:"none", border:"none", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:20, padding:"0 4px", lineHeight:1 },
  tabBar: { display:"flex", gap:0, overflowX:"auto", paddingBottom:0, marginTop:8 },
  tab: (active, done) => ({ padding:"8px 12px", background:"none", border:"none", borderBottom:active?"2px solid #fff":"2px solid transparent", color:"#fff", opacity:active?1:done?0.7:0.35, fontSize:11, fontWeight:active?700:500, cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s" }),
  progressWrap: { height:3, background:"rgba(255,255,255,0.15)", marginTop:0 },
  progressFill: (pct) => ({ height:"100%", width:`${pct}%`, background:"#60a5fa", borderRadius:2, transition:"width .4s ease" }),
  body: { flex:1, overflow:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:12, background:"#f8fafc" },
  msgRow: (isUser) => ({ display:"flex", justifyContent:isUser?"flex-end":"flex-start", gap:8, animation:"fadeUp .25s ease both" }),
  msgBubble: (isUser) => ({
    maxWidth:"75%", padding:"12px 16px", borderRadius:isUser?"14px 14px 4px 14px":"14px 14px 14px 4px",
    background:isUser?"linear-gradient(135deg, #2563eb, #1e40af)":"#f1f5f9",
    color:isUser?"#fff":"#1e293b", fontSize:14, lineHeight:1.5,
    boxShadow:isUser?"0 2px 8px rgba(37,99,235,0.2)":"none",
  }),
  sysAvatar: { width:28, height:28, borderRadius:"50%", background:"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#64748b", flexShrink:0, fontFamily:"'IBM Plex Mono',monospace" },
  widget: { maxWidth:"85%", padding:0, background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" },
  widgetInner: { padding:"16px 18px" },
  inputArea: { padding:"12px 20px", borderTop:"1px solid #e2e8f0", background:"#fff", display:"flex", alignItems:"center", gap:10, flexShrink:0 },
  textInput: { flex:1, padding:"10px 14px", border:"1px solid #e2e8f0", borderRadius:10, fontSize:14, outline:"none", color:"#1e293b", background:"#f8fafc", transition:"border-color .15s" },
  sendBtn: { width:40, height:40, borderRadius:10, border:"none", background:"linear-gradient(135deg, #2563eb, #1e40af)", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, transition:"opacity .15s" },
  chip: (selected) => ({ padding:"6px 14px", borderRadius:99, border:`1.5px solid ${selected?"#2563eb":"#e2e8f0"}`, background:selected?"#eff6ff":"#fff", color:selected?"#2563eb":"#475569", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s", whiteSpace:"nowrap" }),
  optionCard: (selected) => ({ padding:"14px 18px", borderRadius:10, border:`2px solid ${selected?"#2563eb":"#e2e8f0"}`, background:selected?"#eff6ff":"#fff", cursor:"pointer", transition:"all .15s", flex:1, minWidth:140 }),
  miniLabel: { fontSize:10, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 },
  miniInput: { width:"100%", padding:"7px 10px", border:"1px solid #e2e8f0", borderRadius:6, fontSize:13, outline:"none", color:"#1e293b" },
  primaryBtn: { padding:"8px 18px", borderRadius:8, background:"#2563eb", color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", transition:"background .15s" },
  secondaryBtn: { padding:"8px 18px", borderRadius:8, background:"#f1f5f9", color:"#1e293b", border:"none", fontSize:13, fontWeight:600, cursor:"pointer" },
  link: { background:"none", border:"none", color:"#64748b", fontSize:12, cursor:"pointer", padding:0 },
  dot: (i) => ({ width:6, height:6, borderRadius:"50%", background:"#94a3b8", animation:`dotPulse .6s ease ${i*0.15}s infinite alternate` }),
};

/* ─── COMPONENT ──────────────────────────────────────────────────*/
const ProjectCreationChat = ({ isOpen, onClose, onProjectCreated, users, allProjects, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState("init");
  const [inputDisabled, setInputDisabled] = useState(true);
  const [inputPlaceholder, setInputPlaceholder] = useState("Type your answer...");
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [doneTab, setDoneTab] = useState(-1);
  const [typing, setTyping] = useState(false);
  const [data, setData] = useState({
    clientName:"", clientId:"", contactName:"", contactEmail:"",
    contactPhone:"", designation:"", cityState:"", dueDiligence:"",
    projectName:"", projectTag:"engineering", projectId:"",
    startDate:"", endDate:"", lldExists:null, lldUrl:"",
    lldAnswers: Array(30).fill(""),
  });
  const [lldIndex, setLldIndex] = useState(0);
  const [multiChips, setMultiChips] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [sheetClients, setSheetClients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [dbMatches, setDbMatches] = useState([]);
  const [dbError, setDbError] = useState(null);
  const [dbStatus, setDbStatus] = useState({ state: "idle", rowCount: 0, error: null }); // idle | loading | ready | error
  const [searchInfo, setSearchInfo] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [googleSignedIn, setGoogleSignedIn] = useState(isGoogleSignedIn());
  const [generatedLLD, setGeneratedLLD] = useState("");
  const [lldGenerating, setLldGenerating] = useState(false);
  const [lldError, setLldError] = useState(null);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const stepHistory = useRef([]);
  // Holds the latest typed client name synchronously, so the clientDbSearch
  // step always searches the value the user just typed — not the value from
  // the previous render that's still closed over by the goStep callback.
  const searchQueryRef = useRef("");

  const scrollBottom = useCallback(() => {
    setTimeout(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, 50);
  }, []);

  const addMsg = useCallback((role, content, element = null) => {
    const msg = { id: UNIQ(), role, content, element };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const sysMsg = useCallback((content, element = null) => {
    setTyping(true);
    return new Promise(resolve => {
      setTimeout(() => {
        setTyping(false);
        const m = addMsg("system", content, element);
        resolve(m);
      }, 400);
    });
  }, [addMsg]);

  useEffect(scrollBottom, [messages, typing, scrollBottom]);

  /* ─── REFRESH CLIENT DB ────────────────────────────────────────*/
  // Calls the sync-clients Supabase edge function: it pulls the Google Sheet
  // server-side and upserts into public.clients, then we re-read from Supabase
  // so the badge reflects the new count.
  const handleRefreshDb = useCallback(async () => {
    if (dbStatus.state === "loading") return;
    setDbStatus({ state: "loading", rowCount: 0, error: null });
    const res = await triggerSheetSync();
    if (res.ok) {
      setDbStatus({ state: "ready", rowCount: res.rowCount, error: null });
    } else {
      console.error(`[clientDb] manual refresh failed — ${res.error}`);
      setDbStatus({ state: "error", rowCount: 0, error: res.error });
    }
  }, [dbStatus.state]);

  /* ─── STEP ENGINE ──────────────────────────────────────────────*/
  const goStep = useCallback(async (step, skipPush) => {
    if (!skipPush) stepHistory.current.push(currentStep);
    setCurrentStep(step);
    setInputDisabled(true);
    setMultiChips([]);

    switch (step) {
      case "init": {
        setActiveTab(0);
        await sysMsg("Hi! I'm the Elecbits project assistant. Let's set up your new project step by step.");
        // Prompt Google sign-in if configured but not signed in
        if (isGoogleConfigured() && !isGoogleSignedIn()) {
          await sysMsg(null, "googleSignIn");
        } else {
          await sysMsg("What is the **client / company name**?" + (sheetClients.length > 0 ? " (Start typing — I'll check if they're already in our system)" : ""));
          setInputDisabled(false);
          setInputPlaceholder("e.g. Acme Corp");
        }
        break;
      }
      case "clientDbSearch": {
        setActiveTab(0);
        setSearchLoading(true);
        // Read from the ref, not data.clientName — the ref is updated
        // synchronously in handleSend, while data.clientName lags one render
        // behind because of React's batched setState semantics.
        const query = searchQueryRef.current || data.clientName;
        await sysMsg(`Let me search our client database for "${query}"...`);
        console.log(`[clientDb] searching for: "${query}"`);
        try {
          const matches = await searchClients(query);
          console.log(`[clientDb] "${query}" → ${matches.length} match(es)`, matches.map(m => m.organisationName));
          setDbMatches(matches);
          setSearchLoading(false);
          if (matches.length === 1) {
            // Auto-fill the canonical name from the sheet
            setData(d => ({ ...d, clientName: matches[0].organisationName }));
            await sysMsg(null, "clientDbSingle");
          } else if (matches.length > 1) {
            await sysMsg(`Found ${matches.length} possible matches in our database:`, "clientDbMulti");
          } else {
            await sysMsg(null, "clientDbNotFound");
          }
        } catch (err) {
          setSearchLoading(false);
          const msg = err instanceof ClientDbError ? err.message : `Unexpected error: ${err.message}`;
          setDbError(msg);
          await sysMsg(null, "clientDbErrorWidget");
        }
        break;
      }
      case "clientSearch": {
        setActiveTab(0);
        setSearchLoading(true);
        await sysMsg("Let me look up some info about this company...");
        const info = await searchCompanyInfo(data.clientName);
        setSearchInfo(info);
        setSearchLoading(false);
        await sysMsg(null, "clientSearchResult");
        break;
      }
      case "clientFound": {
        setActiveTab(0);
        await sysMsg(null, "clientFoundCard");
        break;
      }
      case "clientId": {
        setActiveTab(0);
        await sysMsg("Great! Let me generate a Client ID for you.", "clientIdWidget");
        break;
      }
      case "contact": {
        setActiveTab(0);
        await sysMsg(`Who is the primary contact person at **${data.clientName}**?`);
        setInputDisabled(false);
        setInputPlaceholder("e.g. Rajesh Kumar");
        break;
      }
      case "designation": {
        setActiveTab(0);
        await sysMsg(`What is **${data.contactName}**'s designation / role?`);
        setInputDisabled(false);
        setInputPlaceholder("e.g. Procurement Manager, CTO, Founder");
        break;
      }
      case "contactPhone": {
        setActiveTab(0);
        await sysMsg("Their phone number?");
        setInputDisabled(false);
        setInputPlaceholder("e.g. +91 98765 43210");
        break;
      }
      case "contactEmail": {
        setActiveTab(0);
        await sysMsg("And their email address?");
        setInputDisabled(false);
        setInputPlaceholder("e.g. rajesh@acme.com");
        break;
      }
      case "cityState": {
        setActiveTab(0);
        await sysMsg("Which city / state is the client based in?");
        setInputDisabled(false);
        setInputPlaceholder("e.g. Gurugram, Haryana");
        break;
      }
      case "dueDiligence": {
        setActiveTab(0);
        await sysMsg("Any reference link for the client? (website, LinkedIn, etc.)");
        setInputDisabled(false);
        setInputPlaceholder("e.g. https://www.acme.com");
        break;
      }
      case "projectName": {
        setActiveTab(1);
        setDoneTab(0);
        await sysMsg("What is the **project / product name**?");
        setInputDisabled(false);
        setInputPlaceholder("e.g. Smart Plug v3");
        break;
      }
      case "projectTag": {
        setActiveTab(1);
        await sysMsg("What type of project is this?", "projectTagPicker");
        break;
      }
      case "projectIdGen": {
        setActiveTab(1);
        await sysMsg("Let me generate a Project ID for you.", "projectIdWidget");
        break;
      }
      case "lldChoice": {
        setActiveTab(2);
        await sysMsg("Does a Low-Level Design (LLD) document already exist for this product?", "lldChoice");
        break;
      }
      case "lldDrive": {
        setActiveTab(2);
        await sysMsg("Search your Google Drive for the LLD document, or paste a URL:", "driveFilePicker");
        break;
      }
      case "lldUrl": {
        setActiveTab(2);
        await sysMsg("Please share the LLD document link:");
        setInputDisabled(false);
        setInputPlaceholder("https://docs.google.com/...");
        break;
      }
      case "lldQuestion": {
        const q = LLD_QUESTIONS[lldIndex];
        if (!q) { goStep("lldGenerating"); return; }
        setActiveTab(q.tab);
        setDoneTab(Math.max(doneTab, q.tab - 1));
        await sysMsg(null, `lldQ_${q.id}`);
        if (q.type === "text") {
          setInputDisabled(false);
          setInputPlaceholder("Type your answer...");
        }
        break;
      }
      case "lldGenerating": {
        setActiveTab(9);
        setDoneTab(9);
        setLldGenerating(true);
        setLldError(null);
        await sysMsg("All 30 questions answered! Now generating your LLD document using AI...", "lldGeneratingWidget");
        try {
          const result = await generateLLD({
            projectName: data.projectName,
            clientName: data.clientName,
            answers: data.lldAnswers,
            projectId: data.projectId,
          });
          setGeneratedLLD(result.lldContent);
          setLldGenerating(false);
          goStep("lldPreview");
        } catch (err) {
          console.error("LLD generation failed, using fallback:", err);
          const fallback = buildFallbackLLD({
            projectName: data.projectName,
            clientName: data.clientName,
            answers: data.lldAnswers,
          });
          setGeneratedLLD(fallback);
          setLldGenerating(false);
          setLldError(err.message);
          goStep("lldPreview");
        }
        break;
      }
      case "lldPreview": {
        setActiveTab(9);
        setDoneTab(9);
        await sysMsg(null, "lldPreviewWidget");
        break;
      }
      case "startDate": {
        setActiveTab(10);
        setDoneTab(9);
        await sysMsg("When does this project **start**?", "startDatePicker");
        break;
      }
      case "endDate": {
        setActiveTab(10);
        setDoneTab(9);
        await sysMsg("Target **end / delivery date**?", "endDatePicker");
        break;
      }
      case "review": {
        setActiveTab(10);
        setDoneTab(10);
        await sysMsg("Here's a summary of everything we've collected:", "reviewSummary");
        break;
      }
      case "done": {
        await sysMsg("Project submitted for sanction! Redirecting...");
        setSubmitted(true);
        setTimeout(() => { onClose(); }, 1500);
        break;
      }
      default: break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lldIndex, doneTab, sysMsg, onClose]);

  const goBack = () => {
    const prev = stepHistory.current.pop();
    if (!prev) return;
    if (prev === "lldQuestion" && lldIndex > 0) {
      setLldIndex(i => i - 1);
    }
    goStep(prev, true);
  };

  const handleSkip = () => {
    if (currentStep === "lldQuestion") {
      const next = lldIndex + 1;
      if (next >= 30) { goStep("lldGenerating"); }
      else { setLldIndex(next); goStep("lldQuestion"); }
    }
  };

  /* ─── START ────────────────────────────────────────────────────*/
  const started = useRef(false);
  useEffect(() => {
    if (isOpen && !started.current) {
      started.current = true;
      // Preload the public client database (so first search is instant
      // and any connection failure is visible before the user types)
      if (isClientDbConfigured()) {
        setDbStatus({ state: "loading", rowCount: 0, error: null });
        preloadClientDb().then(res => {
          if (res.ok) {
            console.log(`[clientDb] preload OK — ${res.rowCount} clients ready`);
            setDbStatus({ state: "ready", rowCount: res.rowCount, error: null });
          } else {
            console.error(`[clientDb] preload FAILED — ${res.error}`);
            setDbStatus({ state: "error", rowCount: 0, error: res.error });
          }
        });
      } else {
        console.error("[clientDb] VITE_CLIENT_SHEET_ID is not set in import.meta.env — restart Vite after editing .env.local");
        setDbStatus({ state: "error", rowCount: 0, error: "VITE_CLIENT_SHEET_ID is not set — restart the dev server" });
      }
      // Fetch existing clients from Google Sheet
      fetchClientsFromSheet().then(clients => {
        setSheetClients(clients);
      });
      goStep("init");
    }
  }, [isOpen, goStep]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      started.current = false;
      setMessages([]);
      setCurrentStep("init");
      setData({ clientName:"",clientId:"",contactName:"",contactEmail:"",contactPhone:"",designation:"",cityState:"",dueDiligence:"",projectName:"",projectTag:"engineering",projectId:"",startDate:"",endDate:"",lldExists:null,lldUrl:"",lldAnswers:Array(30).fill("") });
      setLldIndex(0);
      setActiveTab(0);
      setDoneTab(-1);
      setSubmitted(false);
      setSuggestions([]);
      setDbMatches([]);
      setDbError(null);
      setDbStatus({ state: "idle", rowCount: 0, error: null });
      searchQueryRef.current = "";
      setSearchInfo(null);
      setGeneratedLLD("");
      setLldGenerating(false);
      setLldError(null);
      setCreatingDoc(false);
      stepHistory.current = [];
    }
  }, [isOpen]);

  /* ─── SUBMIT TEXT ──────────────────────────────────────────────*/
  const handleSend = () => {
    const val = inputValue.trim();
    if (!val || inputDisabled) return;
    addMsg("user", val);
    setInputValue("");
    setInputDisabled(true);

    switch (currentStep) {
      case "init": {
        searchQueryRef.current = val; // synchronous — bypasses stale React closure in goStep
        setData(d => ({ ...d, clientName: val }));
        setSuggestions([]);
        setTimeout(() => goStep("clientDbSearch"), 100);
        break;
      }
      case "contact":
        setData(d => ({ ...d, contactName: val }));
        setTimeout(() => goStep("designation"), 100);
        break;
      case "designation":
        setData(d => ({ ...d, designation: val }));
        setTimeout(() => goStep("contactPhone"), 100);
        break;
      case "contactPhone":
        setData(d => ({ ...d, contactPhone: val }));
        setTimeout(() => goStep("contactEmail"), 100);
        break;
      case "contactEmail":
        setData(d => ({ ...d, contactEmail: val }));
        setTimeout(() => goStep("cityState"), 100);
        break;
      case "cityState":
        setData(d => ({ ...d, cityState: val }));
        setTimeout(() => goStep("dueDiligence"), 100);
        break;
      case "dueDiligence":
        setData(d => {
          const updated = { ...d, dueDiligence: val };
          // Patch all collected fields onto the client row in Supabase
          if (updated.clientId) {
            updateClientFields(updated.clientId, {
              contactName:  updated.contactName,
              designation:  updated.designation,
              contactPhone: updated.contactPhone,
              contactEmail: updated.contactEmail,
              cityState:    updated.cityState,
              dueDiligence: val,
            });
          }
          return updated;
        });
        setTimeout(() => goStep("projectName"), 100);
        break;
      case "projectName":
        setData(d => ({ ...d, projectName: val }));
        setTimeout(() => goStep("projectTag"), 100);
        break;
      case "lldUrl":
        setData(d => ({ ...d, lldUrl: val }));
        setTimeout(() => goStep("startDate"), 100);
        break;
      case "lldQuestion": {
        setData(d => {
          const a = [...d.lldAnswers];
          a[lldIndex] = val;
          return { ...d, lldAnswers: a };
        });
        const next = lldIndex + 1;
        if (next >= 30) setTimeout(() => goStep("lldGenerating"), 100);
        else { setLldIndex(next); setTimeout(() => goStep("lldQuestion"), 100); }
        break;
      }
      default: break;
    }
  };

  /* ─── SUBMIT PROJECT ───────────────────────────────────────────*/
  const submitProject = async () => {
    setInputDisabled(true);
    addMsg("user", "Submit for Sanction");

    const projectId = data.projectId;
    const { data: proj, error: pe } = await supabase.from("projects").insert({
      name:             data.projectName,
      project_id:       projectId,
      product_ids:      [],
      client_name:      data.clientName || null,
      client_id:        data.clientId || null,
      project_tag:      data.projectTag || "engineering",
      description:      null,
      start_date:       data.startDate || null,
      end_date:         data.endDate || null,
      rag:              "amber",
      sanctioned:       false,
      pending_sanction: true,
      checklist_config: {},
      created_by:       currentUser.id,
      lld_url:          data.lldUrl || null,
      lld_data:         data.lldExists ? null : { answers: data.lldAnswers, contact: data.contactName, email: data.contactEmail, generatedDocument: generatedLLD || null },
      dirty:            true,
      date_of_entry:    new Date().toISOString().slice(0, 10),
    }).select().single();

    if (pe) {
      await sysMsg(`Error creating project: ${pe.message}. Please try again.`);
      return;
    }

    // Insert default checklists
    const clRows = [
      { project_id:proj.id, key:"pm_milestone",    base_key:"pm_milestone",    label:projectId+"_PM / Milestone Checklist", icon:"🎯", order_index:0 },
      { project_id:proj.id, key:"hw_design",       base_key:"hw_design",       label:projectId+"_GW / Hardware Checklist",  icon:"⬡", order_index:1 },
      { project_id:proj.id, key:"hw_testing",      base_key:"hw_testing",      label:projectId+"_Hardware Testing Checklist", icon:"🔬", order_index:2 },
      { project_id:proj.id, key:"fw_logic",        base_key:"fw_logic",        label:projectId+"_Firmware — Logic Checklist", icon:"◈", order_index:3 },
      { project_id:proj.id, key:"fw_testing",      base_key:"fw_testing",      label:projectId+"_Firmware Testing Checklist", icon:"🧪", order_index:4 },
      { project_id:proj.id, key:"id_design",       base_key:"id_design",       label:projectId+"_Industrial Design Checklist", icon:"◉", order_index:5 },
      { project_id:proj.id, key:"id_testing",      base_key:"id_testing",      label:projectId+"_Industrial Design Testing Checklist", icon:"📐", order_index:6 },
      { project_id:proj.id, key:"overall_testing",  base_key:"overall_testing",  label:projectId+"_Overall Testing",          icon:"✅", order_index:7 },
      { project_id:proj.id, key:"production",       base_key:"production",       label:projectId+"_Production Checklist",     icon:"🏭", order_index:8 },
    ];
    await supabase.from("checklists").insert(clRows);

    if (onProjectCreated) {
      onProjectCreated({
        ...proj,
        projectId: proj.project_id,
        projectTag: proj.project_tag,
        clientName: proj.client_name,
        clientId: proj.client_id,
        startDate: proj.start_date,
        endDate: proj.end_date,
        pendingSanction: proj.pending_sanction,
        checklistConfig: {},
        teamAssignments: [],
        checklists: {},
        customChecklists: {},
        communications: [],
        notifications: [],
        productIds: [],
      });
    }

    // Update the sheet row with contact info if this was a new client (row was added at ID generation time)
    // For existing clients, no sheet write needed
    // Note: contact name/email are collected after ID generation, so we update the sheet row here
    const cachedClient = sheetClients.find(c => c.clientId === data.clientId);
    if (cachedClient && (!cachedClient.contactName || !cachedClient.contactEmail)) {
      // Update local cache with contact info collected during the flow
      setSheetClients(prev => prev.map(c =>
        c.clientId === data.clientId
          ? { ...c, contactName: data.contactName || c.contactName, contactEmail: data.contactEmail || c.contactEmail }
          : c
      ));
    }

    // Auto-push project to Google Sheet in the background
    pushDirtyProjectsToSheet().then(res => {
      if (res.ok) console.log(`[projectsDb] auto-push OK: ${res.pushed} rows pushed to sheet`);
      else console.warn(`[projectsDb] auto-push failed: ${res.error}`);
    });

    goStep("done");
  };

  /* ─── PROGRESS ─────────────────────────────────────────────────*/
  const totalSteps = 14 + (data.lldExists === false ? 30 : 0);
  const currentQ = (() => {
    const base = { init:1, clientId:2, contact:3, designation:4, contactPhone:5, contactEmail:6, cityState:7, dueDiligence:8, projectName:9, projectTag:10, projectIdGen:11, lldChoice:12 };
    if (base[currentStep]) return base[currentStep];
    if (currentStep === "lldUrl") return 9;
    if (currentStep === "lldQuestion") return 8 + lldIndex + 1;
    if (currentStep === "startDate") return totalSteps - 2;
    if (currentStep === "endDate") return totalSteps - 1;
    if (currentStep === "review" || currentStep === "done") return totalSteps;
    return 0;
  })();
  const progressPct = totalSteps > 0 ? Math.round((currentQ / totalSteps) * 100) : 0;

  /* ─── INLINE WIDGETS ───────────────────────────────────────────*/
  const ClientIdWidget = () => {
    const [industry, setIndustry] = useState(INDUSTRY_CODES[0].code);
    const [orgSize, setOrgSize] = useState(ORG_SIZES[0].code);
    // Default count = (number of clients already in the sheet) + 1, so the
    // next ID continues the sequence instead of restarting at 001.
    const [count, setCount] = useState(() => Math.max(1, (dbStatus.rowCount || 0) + 1));
    const [saving, setSaving] = useState(false);
    const genId = `Eb-${industry}-${orgSize}-${String(count).padStart(3,"0")}`;
    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#475569" }}>Client ID Generator</div>
        <div style={S.widgetInner}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <div style={S.miniLabel}>Client Name</div>
              <input style={{ ...S.miniInput, background:"#f1f5f9", color:"#64748b" }} value={data.clientName} readOnly />
            </div>
            <div>
              <div style={S.miniLabel}>Industry</div>
              <select style={S.miniInput} value={industry} onChange={e=>setIndustry(e.target.value)}>
                {INDUSTRY_CODES.map(i=><option key={i.code} value={i.code}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <div style={S.miniLabel}>Org Size</div>
              <select style={S.miniInput} value={orgSize} onChange={e=>setOrgSize(e.target.value)}>
                {ORG_SIZES.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div style={S.miniLabel}>Count</div>
              <input type="number" min={1} style={S.miniInput} value={count} onChange={e=>setCount(Math.max(1,+e.target.value))} />
            </div>
          </div>
          <div style={{ padding:"10px 14px", background:"#f0f9ff", borderRadius:8, textAlign:"center", fontSize:18, fontWeight:800, fontFamily:"'IBM Plex Mono',monospace", color:"#1e3a8a", letterSpacing:"0.04em", marginBottom:12 }}>{genId}</div>
          <button style={{ ...S.primaryBtn, width:"100%", opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={async () => {
            const indLabel = INDUSTRY_CODES.find(x=>x.code===industry)?.label || "";
            const sizeLabel = ORG_SIZES.find(x=>x.code===orgSize)?.label || "";
            setData(d=>({...d, clientId: genId, _industry: indLabel, _size: sizeLabel }));
            addMsg("user", genId);
            setSaving(true);
            // Insert the new client directly into Supabase (dirty=true).
            // No Google sign-in required. The sync function preserves dirty rows.
            // Additional fields (contact, location, etc.) are collected in later
            // steps and patched onto the row via updateClientFields().
            const saveRes = await appendNewClient({
              sNo: count,
              organisationName: data.clientName,
              clientId: genId,
              industry: indLabel,
              orgSize: sizeLabel,
            });
            if (saveRes.ok) {
              setDbStatus(s => ({ ...s, rowCount: saveRes.rowCount }));
              addMsg("system", `✓ Saved ${data.clientName} to the client database.`);
            } else {
              console.warn("[clientDb] save failed:", saveRes.error);
              addMsg("system", `⚠ Failed to save to database (${saveRes.error}). Please add ${data.clientName} (${genId}) manually.`);
            }
            setSaving(false);
            setTimeout(()=>goStep("contact"), 100);
          }}>{saving ? "Saving…" : "Use this Client ID →"}</button>
        </div>
      </div>
    );
  };

  /* ─── GOOGLE SIGN-IN WIDGET ────────────────────────────────────*/
  const GoogleSignInWidget = () => {
    const [loading, setLoading] = useState(false);
    const handleSignIn = async () => {
      setLoading(true);
      const token = await signInWithGoogle();
      setLoading(false);
      if (token) {
        setGoogleSignedIn(true);
        // Refetch clients now that we have API access
        const clients = await fetchClientsFromSheet();
        setSheetClients(clients);
        addMsg("system", `Connected to Google Drive (${clients.length} client${clients.length !== 1 ? "s" : ""} loaded from sheet).`);
        await sysMsg("What is the **client / company name**?" + (clients.length > 0 ? " (Start typing — I'll check if they're already in our system)" : ""));
        setInputDisabled(false);
        setInputPlaceholder("e.g. Acme Corp");
      } else {
        addMsg("system", "Google sign-in was cancelled. You can still continue without it.");
        await sysMsg("What is the **client / company name**?");
        setInputDisabled(false);
        setInputPlaceholder("e.g. Acme Corp");
      }
    };
    const handleSkip = async () => {
      await sysMsg("What is the **client / company name**?");
      setInputDisabled(false);
      setInputPlaceholder("e.g. Acme Corp");
    };
    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#fef3c7", borderBottom:"1px solid #fde68a", fontSize:12, fontWeight:600, color:"#92400e", display:"flex", alignItems:"center", gap:6 }}>
          <span>🔗</span> Connect Google Drive
        </div>
        <div style={S.widgetInner}>
          <div style={{ fontSize:13, color:"#475569", marginBottom:12, lineHeight:1.5 }}>
            Sign in with Google to read/write client data from your spreadsheets and access LLD documents from Drive.
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...S.primaryBtn, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:loading?0.6:1 }} disabled={loading} onClick={handleSignIn}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {loading ? "Connecting..." : "Connect Google Account"}
            </button>
            <button style={S.secondaryBtn} onClick={handleSkip}>Skip</button>
          </div>
        </div>
      </div>
    );
  };

  /* ─── DRIVE FILE PICKER WIDGET (for LLD docs) ────────────────*/
  const DriveFilePicker = () => {
    const [driveFiles, setDriveFiles] = useState([]);
    const [driveLoading, setDriveLoading] = useState(false);
    const [driveQuery, setDriveQuery] = useState("");
    const [searched, setSearched] = useState(false);

    const searchDrive = async () => {
      if (!driveQuery.trim()) return;
      setDriveLoading(true);
      setSearched(true);
      try {
        const files = await searchDriveFiles({
          query: driveQuery,
          maxResults: 10,
        });
        setDriveFiles(files);
      } catch (err) {
        console.error("[drive] search error:", err);
        setDriveFiles([]);
      }
      setDriveLoading(false);
    };

    const selectFile = (file) => {
      const url = file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`;
      setData(d => ({ ...d, lldExists: true, lldUrl: url }));
      addMsg("user", `Selected: ${file.name}`);
      setTimeout(() => goStep("startDate"), 100);
    };

    const mimeIcon = (mime) => {
      if (mime?.includes("spreadsheet")) return "📊";
      if (mime?.includes("document")) return "📄";
      if (mime?.includes("presentation")) return "📽";
      if (mime?.includes("pdf")) return "📕";
      return "📁";
    };

    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#eff6ff", borderBottom:"1px solid #bfdbfe", fontSize:12, fontWeight:600, color:"#1d4ed8", display:"flex", alignItems:"center", gap:6 }}>
          <span>📂</span> Search Google Drive
        </div>
        <div style={S.widgetInner}>
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <input style={S.miniInput} value={driveQuery} onChange={e => setDriveQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") searchDrive(); }}
              placeholder="Search for LLD document..." />
            <button style={S.primaryBtn} onClick={searchDrive} disabled={driveLoading}>
              {driveLoading ? "..." : "Search"}
            </button>
          </div>
          {searched && driveFiles.length === 0 && !driveLoading && (
            <div style={{ fontSize:12, color:"#64748b", textAlign:"center", padding:8 }}>No files found</div>
          )}
          {driveFiles.length > 0 && (
            <div style={{ maxHeight:200, overflow:"auto", borderRadius:6, border:"1px solid #e2e8f0" }}>
              {driveFiles.map(f => (
                <div key={f.id} style={{ padding:"8px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, borderBottom:"1px solid #f1f5f9", transition:"background .1s" }}
                  onClick={() => selectFile(f)}
                  onMouseEnter={e => e.currentTarget.style.background="#f0f9ff"}
                  onMouseLeave={e => e.currentTarget.style.background="#fff"}>
                  <span>{mimeIcon(f.mimeType)}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                    <div style={{ fontSize:10, color:"#94a3b8" }}>{f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:8, display:"flex", gap:8 }}>
            <button style={{ ...S.link, color:"#2563eb", fontSize:12 }} onClick={() => {
              setInputDisabled(false);
              setInputPlaceholder("Paste LLD document URL...");
              addMsg("system", "Or paste the document URL directly:");
            }}>Paste URL instead</button>
          </div>
        </div>
      </div>
    );
  };

  const ClientFoundCard = () => {
    const c = sheetClients.find(x => x.clientName.toLowerCase() === data.clientName.toLowerCase()) || {};
    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#f0fdf4", borderBottom:"1px solid #bbf7d0", fontSize:12, fontWeight:600, color:"#16a34a", display:"flex", alignItems:"center", gap:6 }}>
          <span>✓</span> Existing Client Found
        </div>
        <div style={S.widgetInner}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:13, marginBottom:14 }}>
            <div><span style={{ color:"#64748b" }}>Client:</span> <strong>{c.clientName || data.clientName}</strong></div>
            <div><span style={{ color:"#64748b" }}>Client ID:</span> <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, color:"#2563eb" }}>{c.clientId || data.clientId}</span></div>
            {c.industry && <div><span style={{ color:"#64748b" }}>Industry:</span> {c.industry}</div>}
            {c.size && <div><span style={{ color:"#64748b" }}>Size:</span> {c.size}</div>}
            {c.contactName && <div><span style={{ color:"#64748b" }}>Contact:</span> {c.contactName}</div>}
            {c.contactEmail && <div><span style={{ color:"#64748b" }}>Email:</span> {c.contactEmail}</div>}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...S.primaryBtn, flex:1 }} onClick={() => {
              // Use existing client data and skip to contact (or project if contact exists)
              if (c.contactName && c.contactEmail) {
                setTimeout(() => goStep("projectName"), 100);
              } else if (c.contactName) {
                setTimeout(() => goStep("contactEmail"), 100);
              } else {
                setTimeout(() => goStep("contact"), 100);
              }
            }}>Use this client →</button>
            <button style={S.secondaryBtn} onClick={() => {
              setData(d => ({ ...d, clientId:"", contactName:"", contactEmail:"" }));
              setTimeout(() => goStep("clientId"), 100);
            }}>Create new ID instead</button>
          </div>
        </div>
      </div>
    );
  };

  // Auto-fill data from a matched DB client and skip past already-known fields
  const acceptDbClient = (c) => {
    setData(d => ({
      ...d,
      clientName:   c.organisationName,
      clientId:     c.clientId     || d.clientId,
      contactName:  c.contactName  || d.contactName,
      contactEmail: c.contactEmail || d.contactEmail,
      contactPhone: c.contactPhone || d.contactPhone,
      designation:  c.designation  || d.designation,
      cityState:    c.cityState    || d.cityState,
      dueDiligence: c.dueDiligence || d.dueDiligence,
    }));
    addMsg("user", `Use ${c.organisationName}`);
    const nextStep = !c.clientId      ? "clientId"
                   : !c.contactName   ? "contact"
                   : !c.contactEmail  ? "contactEmail"
                   : "projectName";
    setTimeout(() => goStep(nextStep), 100);
  };

  const ClientDbSingleCard = () => {
    const c = dbMatches[0];
    if (!c) return null;
    const hasMeta = c.industry || c.orgSize || c.employees || c.funding || c.dueDiligence;
    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#f0fdf4", borderBottom:"1px solid #bbf7d0", fontSize:12, fontWeight:600, color:"#16a34a", display:"flex", alignItems:"center", gap:6 }}>
          <span>✓</span> Match found in client database
        </div>
        <div style={S.widgetInner}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#1e293b" }}>{c.organisationName}</div>
            {c.clientId && <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, color:"#2563eb" }}>{c.clientId}</span>}
          </div>
          <div style={{ fontSize:11, color:"#64748b", marginBottom:12 }}>Sheet row {c.rowNumber}</div>
          {(c.contactName || c.contactEmail || c.contactPhone) && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:4, fontSize:12, marginBottom:10, paddingTop:10, borderTop:"1px solid #f1f5f9" }}>
              {c.contactName  && <div><span style={{ color:"#64748b" }}>Contact:</span> {c.contactName}{c.designation ? ` — ${c.designation}` : ""}</div>}
              {c.contactEmail && <div><span style={{ color:"#64748b" }}>Email:</span> {c.contactEmail}</div>}
              {c.contactPhone && <div><span style={{ color:"#64748b" }}>Phone:</span> {c.contactPhone}</div>}
            </div>
          )}
          {hasMeta && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:4, fontSize:12, marginBottom:14, paddingTop:10, borderTop:"1px solid #f1f5f9" }}>
              {c.industry     && <div><span style={{ color:"#64748b" }}>Industry:</span> {c.industry}</div>}
              {c.orgSize      && <div><span style={{ color:"#64748b" }}>Org size:</span> {c.orgSize}</div>}
              {c.employees    && <div><span style={{ color:"#64748b" }}>Employees:</span> {c.employees}</div>}
              {c.funding      && <div><span style={{ color:"#64748b" }}>Funding:</span> {c.funding}</div>}
              {c.dueDiligence && <div><span style={{ color:"#64748b" }}>Due diligence:</span> {c.dueDiligence}</div>}
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...S.primaryBtn, flex:1 }} onClick={() => acceptDbClient(c)}>✓ Use this client</button>
            <button style={S.secondaryBtn} onClick={() => {
              addMsg("user", "Different company");
              setTimeout(() => goStep("init"), 100);
            }}>✗ Different company</button>
          </div>
        </div>
      </div>
    );
  };

  const ClientDbMultiChips = () => (
    <div style={S.widget}>
      <div style={{ padding:"10px 18px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#475569", display:"flex", alignItems:"center", gap:6 }}>
        <span>🔎</span> Pick the right one
      </div>
      <div style={S.widgetInner}>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
          {dbMatches.map((c, i) => (
            <button key={i} style={{ ...S.chip(false), textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 14px" }} onClick={() => acceptDbClient(c)}>
              <span style={{ fontWeight:600 }}>{c.organisationName}</span>
              {c.clientId && <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:"#2563eb", fontWeight:700, marginLeft:8 }}>{c.clientId}</span>}
            </button>
          ))}
        </div>
        <button style={{ ...S.link, color:"#2563eb" }} onClick={() => {
          addMsg("user","None of these");
          setTimeout(() => goStep("init"), 100);
        }}>None of these — re-enter name</button>
      </div>
    </div>
  );

  const ClientDbErrorWidget = () => (
    <div style={S.widget}>
      <div style={{ padding:"10px 18px", background:"#fee2e2", borderBottom:"1px solid #fecaca", fontSize:12, fontWeight:600, color:"#b91c1c", display:"flex", alignItems:"center", gap:6 }}>
        <span>⚠</span> Couldn't reach client database
      </div>
      <div style={S.widgetInner}>
        <div style={{ fontSize:13, color:"#475569", marginBottom:6, lineHeight:1.5 }}>
          {dbError || "Unknown error"}
        </div>
        <div style={{ fontSize:11, color:"#94a3b8", marginBottom:14, lineHeight:1.5 }}>
          Open the browser console for the full <code style={{ background:"#f1f5f9", padding:"1px 4px", borderRadius:3 }}>[clientDb]</code> log line. Most common cause: the dev server wasn't restarted after editing <code style={{ background:"#f1f5f9", padding:"1px 4px", borderRadius:3 }}>.env.local</code>.
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ ...S.primaryBtn, flex:1 }} onClick={() => {
            addMsg("user", "Retry");
            setDbError(null);
            setTimeout(() => goStep("clientDbSearch"), 100);
          }}>Retry search</button>
          <button style={S.secondaryBtn} onClick={() => {
            addMsg("user", "Continue without database");
            setDbError(null);
            setTimeout(() => goStep("clientSearch"), 100);
          }}>Continue anyway</button>
        </div>
      </div>
    </div>
  );

  const ClientDbNotFound = () => (
    <div style={S.widget}>
      <div style={{ padding:"10px 18px", background:"#fef3c7", borderBottom:"1px solid #fde68a", fontSize:12, fontWeight:600, color:"#92400e", display:"flex", alignItems:"center", gap:6 }}>
        <span>!</span> Not found in our client database
      </div>
      <div style={S.widgetInner}>
        <div style={{ fontSize:13, color:"#475569", marginBottom:14, lineHeight:1.5 }}>
          <strong>{data.clientName}</strong> isn't in the sheet yet. Proceed as a new client?
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ ...S.primaryBtn, flex:1 }} onClick={() => {
            addMsg("user", "Yes, new client");
            setTimeout(() => goStep("clientSearch"), 100);
          }}>Yes, new client →</button>
          <button style={S.secondaryBtn} onClick={() => {
            addMsg("user", "No, re-enter");
            setTimeout(() => goStep("init"), 100);
          }}>No, re-enter</button>
        </div>
      </div>
    </div>
  );

  const ClientSearchResult = () => {
    if (searchLoading) {
      return (
        <div style={{ ...S.msgBubble(false), maxWidth:"85%", display:"flex", alignItems:"center", gap:8 }}>
          <div style={S.dot(0)} /><div style={S.dot(1)} /><div style={S.dot(2)} />
          <span style={{ fontSize:12, color:"#64748b" }}>Searching...</span>
        </div>
      );
    }
    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#475569", display:"flex", alignItems:"center", gap:6 }}>
          <span>🔍</span> Company Info — {data.clientName}
        </div>
        <div style={S.widgetInner}>
          {searchInfo ? (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:13, color:"#1e293b", lineHeight:1.6, marginBottom:8 }}>{searchInfo.abstract}</div>
              {searchInfo.url && <a href={searchInfo.url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#2563eb", textDecoration:"none" }}>{searchInfo.url}</a>}
              <div style={{ fontSize:10, color:"#94a3b8", marginTop:4 }}>Source: {searchInfo.source}</div>
            </div>
          ) : (
            <div style={{ padding:"10px 0", fontSize:13, color:"#64748b", marginBottom:10 }}>
              No automatic info found. You can verify manually:
              <a href={`https://www.google.com/search?q=${encodeURIComponent(data.clientName + " company")}`} target="_blank" rel="noreferrer" style={{ display:"block", marginTop:6, color:"#2563eb", fontSize:12, textDecoration:"none" }}>🔗 Search "{data.clientName}" on Google →</a>
            </div>
          )}
          <div style={{ fontSize:11, color:"#64748b", marginBottom:10 }}>Is this the right company?</div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...S.primaryBtn, flex:1 }} onClick={() => {
              addMsg("user", "Yes, that's correct");
              setTimeout(() => goStep("clientId"), 100);
            }}>Yes, proceed →</button>
            <button style={S.secondaryBtn} onClick={() => {
              addMsg("user", "No, let me re-enter");
              setTimeout(() => goStep("init"), 100);
            }}>No, re-enter name</button>
          </div>
        </div>
      </div>
    );
  };

  const ProjectTagPicker = () => {
    const tags = [
      { key:"engineering", label:"Engineering Project", desc:"Hardware & firmware", icon:"⚡" },
      { key:"elecbits_product", label:"EB Product", desc:"Internal product dev", icon:"🔧" },
      { key:"modifier", label:"Modifier", desc:"Design modifications", icon:"✏️" },
    ];
    return (
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", maxWidth:"85%" }}>
        {tags.map(t => (
          <div key={t.key} style={S.optionCard(false)} onClick={() => {
            setData(d=>({...d, projectTag: t.key}));
            addMsg("user", t.label);
            setTimeout(()=>goStep("projectIdGen"), 100);
          }} onMouseEnter={e=>{ e.currentTarget.style.borderColor="#2563eb"; e.currentTarget.style.background="#eff6ff"; }} onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#fff"; }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{t.icon}</div>
            <div style={{ fontWeight:700, fontSize:13, color:"#1e293b", marginBottom:2 }}>{t.label}</div>
            <div style={{ fontSize:11, color:"#64748b" }}>{t.desc}</div>
          </div>
        ))}
      </div>
    );
  };

  const ProjectIdWidget = () => {
    const clientId = data.clientId || "";
    const [count, setCount] = useState(1);
    const [loadingCount, setLoadingCount] = useState(true);
    const genId = `EbZ-${clientId}-${String(count).padStart(3,"0")}`;
    const isDuplicate = allProjects.some(p => p.projectId === genId);

    const refreshCount = async () => {
      setLoadingCount(true);
      const next = await getNextProjectCount(clientId);
      setCount(next);
      setLoadingCount(false);
    };

    // Auto-calculate the next count for this client on mount
    useEffect(() => {
      let cancelled = false;
      (async () => {
        const next = await getNextProjectCount(clientId);
        if (!cancelled) { setCount(next); setLoadingCount(false); }
      })();
      return () => { cancelled = true; };
    }, [clientId]);

    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#475569", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span>Project ID Generator</span>
          <button onClick={refreshCount} disabled={loadingCount} style={{ background:"none", border:"1px solid #cbd5e1", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:600, color:"#475569", cursor: loadingCount ? "not-allowed" : "pointer", opacity: loadingCount ? 0.5 : 1, display:"flex", alignItems:"center", gap:4 }}
            title="Re-fetch count from Supabase & Google Sheet">
            {loadingCount ? "..." : "\u21BB"} Refresh
          </button>
        </div>
        <div style={S.widgetInner}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <div style={S.miniLabel}>Client ID</div>
              <input style={{ ...S.miniInput, background:"#f1f5f9", color:"#64748b" }} value={clientId} readOnly />
            </div>
            <div>
              <div style={S.miniLabel}>Project Count</div>
              <input type="number" min={1} style={S.miniInput} value={count} onChange={e=>setCount(Math.max(1,+e.target.value))} disabled={loadingCount} />
            </div>
          </div>
          <div style={{ padding:"10px 14px", background:"#f0f9ff", borderRadius:8, textAlign:"center", marginBottom:4 }}>
            <div style={{ fontSize:18, fontWeight:800, fontFamily:"'IBM Plex Mono',monospace", color:"#1e3a8a", letterSpacing:"0.04em" }}>{loadingCount ? "Loading…" : genId}</div>
            <div style={{ fontSize:10, color:"#64748b", marginTop:4 }}>
              <span style={{ background:"#e0e7ff", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>EbZ</span>
              {" — "}
              <span style={{ background:"#e0e7ff", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>{clientId}</span>
              {" — "}
              <span style={{ background:"#e0e7ff", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>{String(count).padStart(3,"0")}</span>
            </div>
          </div>
          {isDuplicate && <div style={{ fontSize:11, color:"#dc2626", marginBottom:8, fontWeight:600 }}>This ID already exists. Change the count.</div>}
          <button style={{ ...S.primaryBtn, width:"100%", marginTop:8, opacity:(isDuplicate||loadingCount)?0.5:1 }} disabled={isDuplicate||loadingCount} onClick={() => {
            setData(d=>({...d, projectId: genId}));
            addMsg("user", genId);
            setTimeout(()=>goStep("lldChoice"), 100);
          }}>Use this Project ID →</button>
        </div>
      </div>
    );
  };

  const DateChips = ({ type }) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0,10);
    const addDays = (d,n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
    const addMonths = (d,n) => { const r = new Date(d); r.setMonth(r.getMonth()+n); return r; };
    const [custom, setCustom] = useState("");

    const chips = type === "start"
      ? [{ label:"Today", val:fmt(today) }, { label:"Next week", val:fmt(addDays(today,7)) }, { label:"Next month", val:fmt(addMonths(today,1)) }]
      : [{ label:"3 months", val:fmt(addMonths(today,3)) }, { label:"6 months", val:fmt(addMonths(today,6)) }, { label:"1 year", val:fmt(addMonths(today,12)) }, { label:"TBD", val:"" }];

    const pick = (val, label) => {
      const key = type === "start" ? "startDate" : "endDate";
      setData(d => ({ ...d, [key]: val }));
      addMsg("user", label + (val ? ` (${val})` : ""));
      setTimeout(() => goStep(type === "start" ? "endDate" : "review"), 100);
    };

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:"85%" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {chips.map(c => <button key={c.label} style={S.chip(false)} onClick={() => pick(c.val, c.label)}>{c.label}</button>)}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <input type="date" style={{ ...S.miniInput, flex:1 }} value={custom} onChange={e => setCustom(e.target.value)} />
          <button style={S.primaryBtn} onClick={() => { if (custom) pick(custom, custom); }}>Set</button>
        </div>
      </div>
    );
  };

  const LldChoiceCards = () => (
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", maxWidth:"85%" }}>
      <div style={S.optionCard(false)} onClick={() => {
        setData(d=>({...d, lldExists:true}));
        addMsg("user","Yes, LLD already exists");
        if (googleSignedIn) {
          setTimeout(()=>goStep("lldDrive"),100);
        } else {
          setTimeout(()=>goStep("lldUrl"),100);
        }
      }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor="#2563eb"; e.currentTarget.style.background="#eff6ff"; }} onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#fff"; }}>
        <div style={{ fontSize:24, marginBottom:6 }}>📄</div>
        <div style={{ fontWeight:700, fontSize:13, color:"#1e293b" }}>Yes, LLD already exists</div>
        <div style={{ fontSize:11, color:"#64748b" }}>{googleSignedIn ? "Browse Drive or paste link" : "Share the document link"}</div>
      </div>
      <div style={S.optionCard(false)} onClick={() => { setData(d=>({...d, lldExists:false})); addMsg("user","No, let's create one now"); setLldIndex(0); setTimeout(()=>goStep("lldQuestion"),100); }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor="#2563eb"; e.currentTarget.style.background="#eff6ff"; }} onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#fff"; }}>
        <div style={{ fontSize:24, marginBottom:6 }}>📝</div>
        <div style={{ fontWeight:700, fontSize:13, color:"#1e293b" }}>No, let's create one now</div>
        <div style={{ fontSize:11, color:"#64748b" }}>30 quick questions</div>
      </div>
    </div>
  );

  const LldQuestionBubble = ({ q }) => {
    const [showHint, setShowHint] = useState(false);

    const pickChip = (val) => {
      if (q.multi) {
        setMultiChips(prev => prev.includes(val) ? prev.filter(v=>v!==val) : [...prev, val]);
      } else {
        setData(d => { const a=[...d.lldAnswers]; a[lldIndex]=val; return {...d, lldAnswers:a}; });
        addMsg("user", val);
        const next = lldIndex + 1;
        if (next >= 30) setTimeout(() => goStep("lldGenerating"), 100);
        else { setLldIndex(next); setTimeout(() => goStep("lldQuestion"), 100); }
      }
    };

    const confirmMulti = () => {
      const val = multiChips.join(", ");
      setData(d => { const a=[...d.lldAnswers]; a[lldIndex]=val; return {...d, lldAnswers:a}; });
      addMsg("user", val);
      setMultiChips([]);
      const next = lldIndex + 1;
      if (next >= 30) setTimeout(() => goStep("lldGenerating"), 100);
      else { setLldIndex(next); setTimeout(() => goStep("lldQuestion"), 100); }
    };

    const generateNow = () => {
      addMsg("user", "⚡ Generate now (skip remaining questions)");
      setTimeout(() => goStep("lldGenerating"), 100);
    };

    return (
      <div style={{ maxWidth:"85%", display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ display:"flex", gap:8 }}>
          <div style={S.sysAvatar}>EB</div>
          <div style={{ ...S.msgBubble(false), display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#2563eb" }}>Q{q.id} of 30</div>
            <div>{q.text}</div>
            <button style={{ ...S.link, color:"#2563eb", fontSize:11, textAlign:"left" }} onClick={()=>setShowHint(!showHint)}>💡 {showHint?"Hide":"Why we ask this"}</button>
            {showHint && <div style={{ fontSize:12, color:"#64748b", background:"#f8fafc", padding:"8px 10px", borderRadius:6, borderLeft:"3px solid #2563eb" }}>{q.hint}</div>}
          </div>
        </div>
        {q.type === "chips" && (
          <div style={{ marginLeft:36, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {q.chips.map(c => <button key={c} style={S.chip(q.multi && multiChips.includes(c))} onClick={() => pickChip(c)}>{c}</button>)}
            </div>
            {q.multi && multiChips.length > 0 && (
              <button style={{ ...S.primaryBtn, alignSelf:"flex-start", fontSize:12 }} onClick={confirmMulti}>Confirm ({multiChips.length} selected) →</button>
            )}
          </div>
        )}
        <div style={{ marginLeft:36, display:"flex", gap:8, alignItems:"center" }}>
          <button
            onClick={generateNow}
            style={{
              fontSize:11, fontWeight:600, padding:"6px 12px", borderRadius:6,
              border:"1px solid #2563eb", background:"#fff", color:"#2563eb", cursor:"pointer",
            }}
            title="Skip remaining questions and generate the LLD now with whatever you've answered so far"
          >
            ⚡ Generate now (skip remaining)
          </button>
          <span style={{ fontSize:10, color:"#94a3b8" }}>Unanswered questions will be marked "Not specified"</span>
        </div>
      </div>
    );
  };

  const LldGeneratingWidget = () => (
    <div style={S.widget}>
      <div style={{ padding:"10px 18px", background:"linear-gradient(135deg, #f0f9ff, #eff6ff)", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#1e40af" }}>
        AI LLD Generation
      </div>
      <div style={{ ...S.widgetInner, textAlign:"center", padding:"32px 18px" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🧠</div>
        <div style={{ fontSize:14, fontWeight:600, color:"#1e293b", marginBottom:8 }}>
          Generating your LLD document...
        </div>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:16 }}>
          Analyzing your responses and creating a comprehensive Low-Level Design document with component recommendations, architecture decisions, and more.
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
          <div style={{ ...S.dot(0), background:"#2563eb" }} />
          <div style={{ ...S.dot(1), background:"#2563eb" }} />
          <div style={{ ...S.dot(2), background:"#2563eb" }} />
        </div>
      </div>
    </div>
  );

  const LldPreviewWidget = () => {
    const handleCreateDoc = async () => {
      setCreatingDoc(true);
      try {
        const docTitle = `LLD — ${data.projectName} — ${data.clientName}`;
        const { documentId, webViewLink } = await createGoogleDoc(docTitle, generatedLLD);
        setData(d => ({ ...d, lldUrl: webViewLink }));
        addMsg("system", `Google Doc created successfully!`);
        await sysMsg(null, "lldDocCreated");
        setCreatingDoc(false);
      } catch (err) {
        console.error("Failed to create Google Doc:", err);
        await sysMsg(`Could not create Google Doc: ${err.message}. You can copy the content manually.`);
        setCreatingDoc(false);
      }
    };

    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"linear-gradient(135deg, #f0fdf4, #dcfce7)", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#16a34a", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>LLD Document Generated</span>
          {lldError && <span style={{ fontSize:10, color:"#d97706", fontWeight:500 }}>Fallback mode — API unavailable</span>}
        </div>
        <div style={S.widgetInner}>
          {/* LLD Preview */}
          <div style={{
            maxHeight:300, overflow:"auto", padding:"14px 16px", background:"#f8fafc",
            borderRadius:8, border:"1px solid #e2e8f0", fontSize:12, lineHeight:1.7,
            fontFamily:"'IBM Plex Mono', monospace", whiteSpace:"pre-wrap", color:"#334155", marginBottom:14,
          }}>
            {generatedLLD.slice(0, 3000)}
            {generatedLLD.length > 3000 && (
              <div style={{ marginTop:8, padding:"8px 12px", background:"#eff6ff", borderRadius:6, color:"#2563eb", fontWeight:600, fontSize:11 }}>
                ... {Math.round(generatedLLD.length / 1000)}k characters total — full content will be saved
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {googleSignedIn && (
              <button
                style={{ ...S.primaryBtn, display:"flex", alignItems:"center", gap:6, opacity: creatingDoc ? 0.6 : 1 }}
                onClick={handleCreateDoc}
                disabled={creatingDoc}
              >
                {creatingDoc ? "Creating..." : "📄 Create Google Doc"}
              </button>
            )}
            <button
              style={S.primaryBtn}
              onClick={() => {
                navigator.clipboard.writeText(generatedLLD).then(() => {
                  addMsg("system", "LLD content copied to clipboard!");
                }).catch(() => {
                  addMsg("system", "Could not copy — please select and copy from the preview above.");
                });
              }}
            >
              📋 Copy to Clipboard
            </button>
            <button
              style={S.primaryBtn}
              onClick={() => {
                const safeName = (data.projectName || "LLD").replace(/[^a-z0-9-_]+/gi, "_");
                const safeClient = (data.clientName || "client").replace(/[^a-z0-9-_]+/gi, "_");
                const filename = `LLD_${safeName}_${safeClient}.md`;
                const blob = new Blob([generatedLLD], { type: "text/markdown;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                addMsg("system", `Downloaded ${filename}`);
              }}
            >
              ⬇️ Download .md
            </button>
            <button
              style={{ ...S.primaryBtn, background:"linear-gradient(135deg, #16a34a, #15803d)" }}
              onClick={() => goStep("startDate")}
            >
              Continue →
            </button>
          </div>

          {!googleSignedIn && (
            <div style={{ marginTop:10, fontSize:11, color:"#64748b" }}>
              Sign in with Google to save the LLD as a Google Doc automatically.
            </div>
          )}
        </div>
      </div>
    );
  };

  const LldDocCreated = () => (
    <div style={{ maxWidth:"85%", padding:"14px 18px", background:"#f0fdf4", borderRadius:12, border:"1px solid #bbf7d0", display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ fontSize:20 }}>✅</span>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:"#16a34a" }}>Google Doc created!</div>
        <a href={data.lldUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#2563eb" }}>{data.lldUrl}</a>
      </div>
    </div>
  );

  const ReviewSummary = () => (
    <div style={S.widget}>
      <div style={{ padding:"10px 18px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#475569" }}>Project Summary</div>
      <div style={S.widgetInner}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:13 }}>
          <div><span style={{ color:"#64748b" }}>Client:</span> <strong>{data.clientName}</strong></div>
          <div><span style={{ color:"#64748b" }}>Client ID:</span> <span style={{ fontFamily:"'IBM Plex Mono',monospace" }}>{data.clientId}</span></div>
          <div><span style={{ color:"#64748b" }}>Contact:</span> {data.contactName}</div>
          {data.designation && <div><span style={{ color:"#64748b" }}>Designation:</span> {data.designation}</div>}
          {data.contactPhone && <div><span style={{ color:"#64748b" }}>Phone:</span> {data.contactPhone}</div>}
          <div><span style={{ color:"#64748b" }}>Email:</span> {data.contactEmail}</div>
          {data.cityState && <div><span style={{ color:"#64748b" }}>Location:</span> {data.cityState}</div>}
          {data.dueDiligence && <div><span style={{ color:"#64748b" }}>Reference:</span> {data.dueDiligence}</div>}
          <div style={{ gridColumn:"span 2", borderTop:"1px solid #e2e8f0", paddingTop:8, marginTop:4 }} />
          <div><span style={{ color:"#64748b" }}>Project:</span> <strong>{data.projectName}</strong></div>
          <div><span style={{ color:"#64748b" }}>Project ID:</span> <span style={{ fontFamily:"'IBM Plex Mono',monospace" }}>{data.projectId}</span></div>
          <div><span style={{ color:"#64748b" }}>Type:</span> {{ engineering:"Engineering", elecbits_product:"EB Product", modifier:"Modifier" }[data.projectTag]}</div>
          <div><span style={{ color:"#64748b" }}>Start:</span> {data.startDate || "TBD"}</div>
          <div><span style={{ color:"#64748b" }}>End:</span> {data.endDate || "TBD"}</div>
          <div><span style={{ color:"#64748b" }}>LLD:</span> {data.lldExists ? "Existing doc" : data.lldExists === false ? "Created via chat" : "—"}</div>
        </div>
        {data.lldExists === false && (
          <div style={{ marginTop:12, padding:"10px 14px", background:"#f0fdf4", borderRadius:8, fontSize:11, color:"#16a34a", fontWeight:600 }}>
            ✓ {data.lldAnswers.filter(a => a).length} of 30 LLD questions answered
            {generatedLLD && " · LLD document generated"}
          </div>
        )}
        {data.lldUrl && (
          <div style={{ marginTop:8, fontSize:12 }}><span style={{ color:"#64748b" }}>LLD URL:</span> <a href={data.lldUrl} target="_blank" rel="noreferrer" style={{ color:"#2563eb" }}>{data.lldUrl}</a></div>
        )}
        <button style={{ ...S.primaryBtn, width:"100%", marginTop:16, padding:"12px 20px", fontSize:14, background:"linear-gradient(135deg, #16a34a, #15803d)" }}
          onClick={submitProject} disabled={submitted}>
          {submitted ? "Submitting..." : "Submit for Sanction →"}
        </button>
      </div>
    </div>
  );

  /* ─── RENDER ELEMENT ───────────────────────────────────────────*/
  const renderElement = (el) => {
    if (!el) return null;
    if (el === "googleSignIn") return <GoogleSignInWidget />;
    if (el === "driveFilePicker") return <DriveFilePicker />;
    if (el === "clientIdWidget") return <ClientIdWidget />;
    if (el === "clientFoundCard") return <ClientFoundCard />;
    if (el === "clientDbSingle") return <ClientDbSingleCard />;
    if (el === "clientDbMulti") return <ClientDbMultiChips />;
    if (el === "clientDbNotFound") return <ClientDbNotFound />;
    if (el === "clientDbErrorWidget") return <ClientDbErrorWidget />;
    if (el === "clientSearchResult") return <ClientSearchResult />;
    if (el === "projectTagPicker") return <ProjectTagPicker />;
    if (el === "projectIdWidget") return <ProjectIdWidget />;
    if (el === "startDatePicker") return <DateChips type="start" />;
    if (el === "endDatePicker") return <DateChips type="end" />;
    if (el === "lldChoice") return <LldChoiceCards />;
    if (el === "lldGeneratingWidget") return <LldGeneratingWidget />;
    if (el === "lldPreviewWidget") return <LldPreviewWidget />;
    if (el === "lldDocCreated") return <LldDocCreated />;
    if (el === "reviewSummary") return <ReviewSummary />;
    if (el.startsWith("lldQ_")) {
      const qId = parseInt(el.split("_")[1]);
      const q = LLD_QUESTIONS.find(x => x.id === qId);
      if (q) return <LldQuestionBubble q={q} />;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Dot animation keyframes */}
      <style>{`@keyframes dotPulse{from{opacity:.3;transform:scale(.8)}to{opacity:1;transform:scale(1)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}} @keyframes dbSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerTop}>
            <div style={S.headerLeft}>
              <div style={S.ebAvatar}>EB</div>
              <div>
                <div style={S.headerTitle}>Elecbits — New Project</div>
                <div style={S.headerSub}>AI-assisted project setup</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {googleSignedIn && (
                <span style={{ ...S.badge, background:"rgba(34,197,94,0.2)", color:"#bbf7d0", fontSize:10, display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", display:"inline-block" }} />
                  Google Drive
                </span>
              )}
              {dbStatus.state !== "idle" && (() => {
                const cfg = dbStatus.state === "ready"
                  ? { bg:"rgba(34,197,94,0.2)", fg:"#bbf7d0", dot:"#4ade80", text:`Client DB · ${dbStatus.rowCount}` }
                  : dbStatus.state === "loading"
                  ? { bg:"rgba(250,204,21,0.2)", fg:"#fef08a", dot:"#facc15", text:"Client DB · loading" }
                  : { bg:"rgba(239,68,68,0.2)", fg:"#fecaca", dot:"#f87171", text:"Client DB · error" };
                const isLoading = dbStatus.state === "loading";
                return (
                  <button
                    type="button"
                    onClick={handleRefreshDb}
                    disabled={isLoading}
                    title={dbStatus.error || "Click to refresh from Google Sheet"}
                    style={{
                      ...S.badge,
                      background: cfg.bg, color: cfg.fg, fontSize: 10,
                      display: "flex", alignItems: "center", gap: 4,
                      border: "none",
                      cursor: isLoading ? "wait" : "pointer",
                      transition: "filter .15s",
                    }}
                    onMouseEnter={e => { if (!isLoading) e.currentTarget.style.filter = "brightness(1.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                  >
                    <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot, display:"inline-block" }} />
                    {cfg.text}
                    <span style={{
                      fontSize: 11, marginLeft: 2,
                      display: "inline-block",
                      animation: isLoading ? "dbSpin 0.8s linear infinite" : "none",
                    }}>↻</span>
                  </button>
                );
              })()}
              <span style={S.badge}>Q {currentQ} of {totalSteps}</span>
              <button style={S.closeBtn} onClick={onClose}>✕</button>
            </div>
          </div>
          {/* Tab bar */}
          <div style={S.tabBar}>
            {TABS.map(t => (
              <button key={t.idx} style={S.tab(activeTab === t.idx, t.idx <= doneTab)}>{t.label}</button>
            ))}
          </div>
          {/* Progress */}
          <div style={S.progressWrap}><div style={S.progressFill(progressPct)} /></div>
        </div>

        {/* Messages */}
        <div ref={bodyRef} style={S.body}>
          {messages.map(msg => {
            if (msg.element) {
              return <div key={msg.id} style={{ animation:"fadeUp .25s ease both" }}>{renderElement(msg.element)}</div>;
            }
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} style={S.msgRow(isUser)}>
                {!isUser && <div style={S.sysAvatar}>EB</div>}
                <div style={S.msgBubble(isUser)}>{msg.content}</div>
              </div>
            );
          })}
          {/* Typing indicator */}
          {typing && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
              <div style={S.sysAvatar}>EB</div>
              <div style={{ ...S.msgBubble(false), display:"flex", gap:4, padding:"14px 20px" }}>
                <div style={S.dot(0)} /><div style={S.dot(1)} /><div style={S.dot(2)} />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{ ...S.inputArea, position:"relative" }}>
          <button style={S.link} onClick={goBack}>← Back</button>
          <div style={{ flex:1, position:"relative" }}>
            <input
              ref={inputRef}
              style={S.textInput}
              value={inputValue}
              onChange={e => {
                const v = e.target.value;
                setInputValue(v);
                // Show autocomplete suggestions when typing client name
                if (currentStep === "init" && v.length >= 2 && sheetClients.length > 0) {
                  const matches = sheetClients.filter(c => c.clientName.toLowerCase().includes(v.toLowerCase())).slice(0, 5);
                  setSuggestions(matches);
                } else {
                  setSuggestions([]);
                }
              }}
              onKeyDown={e => { if (e.key === "Enter") { setSuggestions([]); handleSend(); } if (e.key === "Escape") setSuggestions([]); }}
              placeholder={inputPlaceholder}
              disabled={inputDisabled}
              onFocus={e => { e.target.style.borderColor="#2563eb"; }}
              onBlur={e => { e.target.style.borderColor="#e2e8f0"; setTimeout(()=>setSuggestions([]),200); }}
            />
            {/* Autocomplete dropdown */}
            {suggestions.length > 0 && (
              <div style={{ position:"absolute", bottom:"100%", left:0, right:0, marginBottom:4, background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, boxShadow:"0 -4px 16px rgba(0,0,0,0.08)", overflow:"hidden", zIndex:10 }}>
                <div style={{ padding:"6px 12px", fontSize:10, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid #f1f5f9" }}>Existing clients in sheet</div>
                {suggestions.map((c, i) => (
                  <div key={i} style={{ padding:"10px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #f8fafc", transition:"background .1s" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setInputValue(c.clientName);
                      setSuggestions([]);
                      setData(d => ({ ...d, clientName: c.clientName, clientId: c.clientId, contactName: c.contactName || "", contactEmail: c.contactEmail || "" }));
                      addMsg("user", c.clientName);
                      setInputValue("");
                      setInputDisabled(true);
                      setTimeout(() => goStep("clientFound"), 100);
                    }}
                    onMouseEnter={e => e.currentTarget.style.background="#f0f9ff"}
                    onMouseLeave={e => e.currentTarget.style.background="#fff"}
                  >
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{c.clientName}</div>
                      <div style={{ fontSize:11, color:"#64748b" }}>{c.industry || ""}{c.industry && c.size ? " · " : ""}{c.size || ""}</div>
                    </div>
                    <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:"#2563eb", fontWeight:600 }}>{c.clientId}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button style={{ ...S.sendBtn, opacity:inputDisabled?0.4:1 }} disabled={inputDisabled} onClick={handleSend}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
          <button style={S.link} onClick={handleSkip}>Skip →</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCreationChat;
