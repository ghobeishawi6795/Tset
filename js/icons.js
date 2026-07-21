/* ---------------------------------------------------------
   Icons (self-contained SVG replacements for lucide-react)
   © ghobeishawi - All rights reserved.
--------------------------------------------------------- */
const { useState, useEffect, useCallback, useRef } = React;

function Icon({ size = 24, color = "currentColor", style, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {children}
    </svg>
  );
}

const GraduationCap = (p) => (
  <Icon {...p}>
    <path d="M22 10 12 5 2 10l10 5 10-5Z" />
    <path d="M6 12.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
    <path d="M22 10v6" />
  </Icon>
);

const LayoutDashboard = (p) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </Icon>
);

const FileText = (p) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6M9 17h6M9 9h1" />
  </Icon>
);

const HelpCircle = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" />
    <path d="M12 17h.01" />
  </Icon>
);

const Users = (p) => (
  <Icon {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

const BarChart3 = (p) => (
  <Icon {...p}>
    <path d="M3 3v18h18" />
    <rect x="7" y="12" width="3" height="6" />
    <rect x="12" y="8" width="3" height="10" />
    <rect x="17" y="5" width="3" height="13" />
  </Icon>
);

const Settings = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.36.35.68.62.94.28.28.6.5.96.62.36.13.75.13 1.02.13H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Icon>
);

const LogOut = (p) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
);

const Eye = (p) => (
  <Icon {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

const EyeOff = (p) => (
  <Icon {...p}>
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.5 20.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </Icon>
);

const Plus = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

const Trash2 = (p) => (
  <Icon {...p}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

const Clock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Icon>
);

const ChevronLeft = (p) => (
  <Icon {...p}><path d="M15 18l-6-6 6-6" /></Icon>
);

const ChevronRight = (p) => (
  <Icon {...p}><path d="M9 18l6-6-6-6" /></Icon>
);

const CheckCircle2 = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

const Circle = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /></Icon>
);

const Download = (p) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </Icon>
);

const Upload = (p) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </Icon>
);

const ArrowRight = (p) => (
  <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
);

const Award = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="6" />
    <path d="M8.7 13.9 7 22l5-3 5 3-1.7-8.1" />
  </Icon>
);

const TrendingUp = (p) => (
  <Icon {...p}>
    <path d="M23 6l-9.5 9.5-5-5L1 18" />
    <path d="M17 6h6v6" />
  </Icon>
);

const ListChecks = (p) => (
  <Icon {...p}>
    <path d="M3.5 5.5 5 7l2.5-2.5" />
    <path d="M3.5 12.5 5 14l2.5-2.5" />
    <path d="M3.5 19.5 5 21l2.5-2.5" />
    <path d="M11 6h10M11 12h10M11 18h10" />
  </Icon>
);

const Percent = (p) => (
  <Icon {...p}>
    <path d="M19 5 5 19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </Icon>
);

const X = (p) => (
  <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
);

const Check = (p) => (
  <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>
);

const Edit2 = (p) => (
  <Icon {...p}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Icon>
);

const AlertTriangle = (p) => (
  <Icon {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);

const MessageSquare = (p) => (
  <Icon {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
);

const Library = (p) => (
  <Icon {...p}>
    <path d="M3 4h4v17H3z" />
    <path d="M9 4h4v17H9z" />
    <path d="m16 4 3.5 1-2 16.5-3.5-1z" />
  </Icon>
);

const Search = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </Icon>
);
