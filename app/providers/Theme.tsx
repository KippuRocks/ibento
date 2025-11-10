"use client";

import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import React from "react";

import { theme } from "../design-system/theme";

export default function Theme({ children }: { children: React.ReactNode }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
