import { alpha, createTheme } from "@mui/material/styles";

export const tokens = {
  colors: {
    primary: "#5B21B6",
    primaryStrong: "#4C1D95",
    secondary: "#14B8A6",
    accent: "#F97316",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceMuted: "#F1F5F9",
    border: "#E2E8F0",
    borderStrong: "#CBD5F5",
    text: {
      primary: "#0F172A",
      secondary: "#475569",
      muted: "#94A3B8",
      inverse: "#FFFFFF",
    },
  },
  spacing: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 20,
    pill: 999,
  },
  shadows: {
    xs: "0px 1px 2px rgba(15, 23, 42, 0.08)",
    sm: "0px 8px 16px rgba(15, 23, 42, 0.08)",
    md: "0px 16px 32px rgba(15, 23, 42, 0.12)",
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    headingWeight: 600,
    displayWeight: 700,
    bodyWeight: 400,
    emphasisWeight: 500,
  },
  layout: {
    pageMaxWidth: 1200,
    contentWidth: 960,
    verticalRhythm: 32,
  },
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: tokens.colors.primary,
      dark: tokens.colors.primaryStrong,
      contrastText: tokens.colors.text.inverse,
    },
    secondary: {
      main: tokens.colors.secondary,
      contrastText: tokens.colors.text.inverse,
    },
    background: {
      default: tokens.colors.background,
      paper: tokens.colors.surface,
    },
    text: {
      primary: tokens.colors.text.primary,
      secondary: tokens.colors.text.secondary,
      disabled: tokens.colors.text.muted,
    },
    divider: tokens.colors.border,
  },
  typography: {
    fontFamily: tokens.typography.fontFamily,
    h1: {
      fontSize: "3.25rem",
      fontWeight: tokens.typography.displayWeight,
      lineHeight: 1.05,
      letterSpacing: "-0.04em",
    },
    h2: {
      fontSize: "2.5rem",
      fontWeight: tokens.typography.headingWeight,
      lineHeight: 1.1,
      letterSpacing: "-0.03em",
    },
    h3: {
      fontSize: "2rem",
      fontWeight: tokens.typography.headingWeight,
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: tokens.typography.headingWeight,
      lineHeight: 1.2,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: tokens.typography.headingWeight,
      lineHeight: 1.3,
    },
    h6: {
      fontSize: "1.125rem",
      fontWeight: tokens.typography.headingWeight,
      lineHeight: 1.35,
    },
    subtitle1: {
      fontSize: "1rem",
      fontWeight: tokens.typography.emphasisWeight,
      lineHeight: 1.5,
      letterSpacing: "-0.01em",
    },
    subtitle2: {
      fontSize: "0.95rem",
      fontWeight: tokens.typography.emphasisWeight,
      lineHeight: 1.45,
    },
    body1: {
      fontSize: "1rem",
      fontWeight: tokens.typography.bodyWeight,
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.95rem",
      fontWeight: tokens.typography.bodyWeight,
      lineHeight: 1.6,
    },
    button: {
      fontWeight: tokens.typography.emphasisWeight,
      textTransform: "none",
      letterSpacing: 0,
    },
    caption: {
      fontSize: "0.8rem",
      fontWeight: tokens.typography.emphasisWeight,
      lineHeight: 1.4,
      letterSpacing: "0.08em",
    },
    overline: {
      fontSize: "0.75rem",
      fontWeight: tokens.typography.emphasisWeight,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
  },
  shape: {
    borderRadius: tokens.radii.md,
  },
  spacing: 4,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          backgroundColor: tokens.colors.background,
          color: tokens.colors.text.primary,
        },
        body: {
          backgroundColor: tokens.colors.background,
          color: tokens.colors.text.primary,
          minHeight: "100dvh",
        },
        "*": {
          boxSizing: "border-box",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: tokens.radii.pill,
          fontWeight: tokens.typography.emphasisWeight,
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
        },
        contained: {
          boxShadow: tokens.shadows.xs,
          "&:hover": {
            boxShadow: tokens.shadows.sm,
          },
        },
        outlined: {
          borderColor: tokens.colors.borderStrong,
          "&:hover": {
            backgroundColor: alpha(tokens.colors.primary, 0.08),
            borderColor: tokens.colors.primary,
          },
        },
        text: {
          paddingLeft: tokens.spacing.sm,
          paddingRight: tokens.spacing.sm,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radii.md,
          border: `1px solid ${tokens.colors.border}`,
          boxShadow: tokens.shadows.xs,
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radii.lg,
          border: `1px solid ${tokens.colors.border}`,
          boxShadow: tokens.shadows.sm,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.colors.surface,
          borderRadius: tokens.radii.sm,
          "& fieldset": {
            borderColor: tokens.colors.border,
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          },
          "&:hover fieldset": {
            borderColor: tokens.colors.primary,
          },
          "&.Mui-focused fieldset": {
            borderColor: tokens.colors.primary,
            boxShadow: `0 0 0 4px ${alpha(tokens.colors.primary, 0.08)}`,
          },
        },
        input: {
          paddingTop: "14px",
          paddingBottom: "14px",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontWeight: tokens.typography.emphasisWeight,
          color: tokens.colors.text.secondary,
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontWeight: tokens.typography.emphasisWeight,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: tokens.colors.border,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radii.sm,
          "&.Mui-selected": {
            backgroundColor: alpha(tokens.colors.primary, 0.08),
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          borderRadius: tokens.radii.sm,
          paddingTop: "14px",
          paddingBottom: "14px",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radii.pill,
          fontWeight: tokens.typography.emphasisWeight,
        },
      },
    },
  },
});

export const typographyPresets = {
  display: { variant: "h1", component: "h1" },
  headline: { variant: "h2", component: "h2" },
  title: { variant: "h3", component: "h3" },
  section: { variant: "h4", component: "h2" },
  subtitle: { variant: "subtitle1", component: "p" },
  eyebrow: { variant: "overline", component: "p" },
  body: { variant: "body1", component: "p" },
  caption: { variant: "caption", component: "p" },
} as const;

export type TypographyPreset = keyof typeof typographyPresets;
