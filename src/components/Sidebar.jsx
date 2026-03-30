import { useState } from "react";

const EB_LOGO_URL = "https://elecbits.in/wp-content/uploads/2025/06/EB-Logo.svg";

const icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  projects: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  analytics: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  services: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

const navItems = [
  { id: "projects", icon: "dashboard", label: "Dashboard" },
  { id: "all-projects", icon: "projects", label: "Projects" },
  { id: "resources", icon: "analytics", label: "Analytics" },
  { id: "alerts", icon: "services", label: "Services" },
  { id: "settings", icon: "shield", label: "Security" },
];

const Tooltip = ({ label }) => (
  <div style={{
    position: "absolute",
    left: 52,
    top: "50%",
    transform: "translateY(-50%)",
    background: "#1e293b",
    color: "#ffffff",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: "nowrap",
    zIndex: 100,
    pointerEvents: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  }}>
    {label}
  </div>
);

const Sidebar = ({ activeView, onChangeView, onLogout, user }) => {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoveredLogout, setHoveredLogout] = useState(false);

  return (
    <div style={{
      width: 60,
      minWidth: 60,
      height: "100vh",
      background: "#0f172a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 16,
      flexShrink: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        width: 44,
        height: 40,
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }} onClick={() => onChangeView("projects")}>
        <img
          src={EB_LOGO_URL}
          alt="Elecbits"
          style={{
            width: 40,
            height: 40,
            objectFit: "contain",
            filter: "brightness(0) invert(1)",
          }}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentElement.innerHTML = '<div style="width:36px;height:36px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center"><span style="font-size:16px;font-family:IBM Plex Mono;font-weight:700;color:#fff">EB</span></div>';
          }}
        />
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const isHovered = hoveredItem === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onChangeView(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all .15s",
                background: isActive ? "#2563eb" : isHovered ? "#1e293b" : "transparent",
                color: isActive ? "#ffffff" : isHovered ? "#94a3b8" : "#475569",
                position: "relative",
              }}
            >
              {icons[item.icon]}
              {isActive && (
                <div style={{
                  position: "absolute",
                  left: -8,
                  width: 3,
                  height: 20,
                  background: "#2563eb",
                  borderRadius: "0 3px 3px 0",
                }}/>
              )}
              {isHovered && <Tooltip label={item.label} />}
            </div>
          );
        })}
      </div>

      {/* User avatar + logout at bottom */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#1e293b",
          border: "2px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#94a3b8",
          fontFamily: "IBM Plex Mono",
        }}>
          {user?.avatar || user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?"}
        </div>
        <div
          onClick={onLogout}
          onMouseEnter={() => setHoveredLogout(true)}
          onMouseLeave={() => setHoveredLogout(false)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all .15s",
            color: hoveredLogout ? "#ef4444" : "#475569",
            position: "relative",
          }}
        >
          {icons.logout}
          {hoveredLogout && <Tooltip label="Sign out" />}
        </div>
      </div>
    </div>
  );
};

export { EB_LOGO_URL };
export default Sidebar;
