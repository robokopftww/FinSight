export const clerkAppearance = {
  variables: {
    colorPrimary: "#a7c3ff",
    colorBackground: "#0a1222",
    colorInputBackground: "rgba(255, 255, 255, 0.05)",
    colorInputText: "#f8fafc",
    colorText: "#f8fafc",
    colorTextSecondary: "#94a3b8",
    colorNeutral: "#f8fafc",
    borderRadius: "1rem",
    fontFamily: "var(--font-manrope), sans-serif",
  },
  elements: {
    cardBox: "shadow-[0_24px_120px_rgba(0,0,0,0.34)]",
    card: "border border-white/10",
    socialButtonsBlockButton: "border-white/10 bg-white/5 text-white hover:bg-white/10",
    formFieldInput: "border-white/10 bg-white/5 text-white",
    footerActionLink: "text-[#a7c3ff] hover:text-[#8fb0ff]",
  },
} as const;
