"use client";

import { useContext, useEffect, useState } from "react";
import type { Event } from "@ticketto/types";
import {
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  CircularProgress,
  Stack,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { TickettoClientContext } from "../providers/TickettoClientProvider";
import {
  PageContainer,
  PageHeader,
  SectionCard,
  Text,
} from "../design-system/components";
import { tokens } from "../design-system/theme";

const EVENT_PLACEHOLDER_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/e/e0/PlaceholderLC.png";

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const provider = useContext(TickettoClientContext);

  useEffect(() => {
    async function fetchData() {
      if (!provider) return;
      const organizerId = provider.accountProvider.getAccountId();
      const fetchedEvents =
        (await provider.events.query.organizerOf(organizerId)) ?? [];
      setEvents(fetchedEvents);
      setIsLoading(false);
    }
    fetchData();
  }, [provider]);

  if (isLoading) {
    return (
      <PageContainer sx={{ minHeight: "100dvh", justifyContent: "center" }}>
        <Stack alignItems="center" gap={tokens.spacing.md}>
          <CircularProgress />
          <Text preset="body" sx={{ color: "text.secondary" }}>
            Loading your events…
          </Text>
        </Stack>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Dashboard"
        title="My events"
        description="Manage your published events, review key information, and create new experiences for your audience."
        actions={
          <Button href="/create-event" variant="contained">
            Create event
          </Button>
        }
      />
      <SectionCard>
        <Stack gap={tokens.spacing.lg}>
          <Text preset="subtitle" sx={{ color: "text.secondary" }}>
            Events you organize
          </Text>
          {events.length > 0 ? (
            <Grid container spacing={3}>
              {events.map((event) => (
                <Grid
                  size={{ xs: 12, sm: 6, md: 4 }}
                  component="div"
                  key={event.id}
                >
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: tokens.radii.lg,
                      border: `1px solid ${tokens.colors.border}`,
                      boxShadow: tokens.shadows.xs,
                      height: "100%",
                    }}
                  >
                    <CardActionArea
                      href={`/update-event/${event.id}`}
                      sx={{ height: "100%" }}
                    >
                      <CardMedia
                        component="img"
                        height="164"
                        image={
                          (event.metadata as { banner?: string } | undefined)
                            ?.banner ?? EVENT_PLACEHOLDER_IMAGE
                        }
                        alt={event.name}
                        sx={{ objectFit: "cover" }}
                      />
                      <CardContent
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: tokens.spacing.sm,
                        }}
                      >
                        <Text preset="subtitle">{event.name}</Text>
                        <Text preset="body" sx={{ color: "text.secondary" }}>
                          {event.date?.[0]
                            ? new Date(
                                Number(event.date[0])
                              ).toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "Date to be confirmed"}
                        </Text>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              gap={tokens.spacing.md}
              sx={{
                borderRadius: tokens.radii.md,
                border: `1px dashed ${tokens.colors.border}`,
                py: tokens.spacing.xl,
                textAlign: "center",
              }}
            >
              <Text preset="subtitle">
                You don't have any published events yet
              </Text>
              <Text
                preset="body"
                sx={{ color: "text.secondary", maxWidth: 420 }}
              >
                Start by creating your first event to monitor its performance,
                manage attendees, and share key information from this dashboard.
              </Text>
              <Button href="/create-event" variant="outlined">
                Create my first event
              </Button>
            </Stack>
          )}
        </Stack>
      </SectionCard>
    </PageContainer>
  );
}
