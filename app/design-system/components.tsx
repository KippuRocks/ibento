"use client";

import React, { forwardRef } from "react";
import {
  Box,
  BoxProps,
  Paper,
  PaperProps,
  Stack,
  StackProps,
  Typography,
  TypographyProps,
  Divider,
  DividerProps,
} from "@mui/material";
import { tokens, typographyPresets, TypographyPreset } from "./theme";

export type TextProps = TypographyProps & {
  preset?: TypographyPreset;
};

export const Text = forwardRef<HTMLSpanElement, TextProps>(function Text(
  { preset = "body", variant, component, children, sx, ...rest },
  ref
) {
  const presetConfig = typographyPresets[preset] ?? typographyPresets.body;
  return (
    <Typography
      ref={ref}
      variant={variant ?? presetConfig.variant}
      component={component ?? presetConfig.component}
      sx={{
        color: "text.primary",
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Typography>
  );
});

export interface PageContainerProps extends BoxProps {
  maxContentWidth?: number;
}

export function PageContainer({
  children,
  maxContentWidth = tokens.layout.contentWidth,
  sx,
  ...rest
}: PageContainerProps) {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: maxContentWidth,
        margin: "0 auto",
        px: { xs: tokens.spacing.md, md: tokens.spacing.xl },
        py: { xs: tokens.spacing.lg, md: tokens.spacing.xxl },
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.xl,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  spacing = tokens.spacing.md,
  sx,
  ...rest
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  spacing?: number;
} & StackProps) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
      gap={tokens.spacing.lg}
      sx={sx}
      {...rest}
    >
      <Stack gap={spacing}>
        {eyebrow && <Text preset="eyebrow">{eyebrow}</Text>}
        <Text preset="title">{title}</Text>
        {description && (
          <Text preset="subtitle" sx={{ color: "text.secondary" }}>
            {description}
          </Text>
        )}
      </Stack>
      {actions && (
        <Box
          sx={{
            display: "flex",
            gap: tokens.spacing.sm,
            flexWrap: "wrap",
            "& > *": {
              width: "auto",
            },
          }}
        >
          {actions}
        </Box>
      )}
    </Stack>
  );
}

export const SectionCard = forwardRef<HTMLDivElement, PaperProps>(
  function SectionCard({ sx, ...rest }, ref) {
    return (
      <Paper
        ref={ref}
        elevation={0}
        sx={{
          borderRadius: tokens.radii.lg,
          background: "background.paper",
          p: { xs: tokens.spacing.lg, md: tokens.spacing.xl },
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing.lg,
          ...sx,
        }}
        {...rest}
      />
    );
  }
);

export function SectionHeader({
  title,
  description,
  action,
  sx,
  ...rest
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
} & StackProps) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
      gap={tokens.spacing.md}
      sx={sx}
      {...rest}
    >
      <Stack gap={tokens.spacing.sm}>
        <Text preset="section">{title}</Text>
        {description && (
          <Text preset="body" sx={{ color: "text.secondary" }}>
            {description}
          </Text>
        )}
      </Stack>
      {action}
    </Stack>
  );
}

export function InlineDivider(props: DividerProps) {
  return (
    <Divider
      flexItem
      sx={{
        borderColor: "divider",
        my: tokens.spacing.md,
      }}
      {...props}
    />
  );
}

export interface FormFieldsetProps extends StackProps {
  heading?: React.ReactNode;
  description?: React.ReactNode;
  supportingText?: React.ReactNode;
}

export function FormFieldset({
  heading,
  description,
  supportingText,
  children,
  sx,
  ...rest
}: FormFieldsetProps) {
  return (
    <Stack
      gap={tokens.spacing.md}
      sx={{
        p: { xs: tokens.spacing.md, md: tokens.spacing.lg },
        borderRadius: tokens.radii.md,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.default",
        ...sx,
      }}
      {...rest}
    >
      {(heading || description) && (
        <Stack gap={tokens.spacing.xs}>
          {heading && <Text preset="subtitle">{heading}</Text>}
          {description && (
            <Text preset="body" sx={{ color: "text.secondary" }}>
              {description}
            </Text>
          )}
        </Stack>
      )}
      {children}
      {supportingText && (
        <Text preset="caption" sx={{ color: "text.secondary" }}>
          {supportingText}
        </Text>
      )}
    </Stack>
  );
}
