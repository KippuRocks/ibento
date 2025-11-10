"use client";

import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AttendancePolicyType } from "@ticketto/types";
import {
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  InputLabel,
  MenuItem,
  Select,
  IconButton,
  Divider,
  FormControl,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import { DateRangePicker } from "mui-daterange-picker";
import { useContext, useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import DeleteIcon from "@mui/icons-material/Delete";
import { TickettoClientContext } from "@/app/providers/TickettoClientProvider";

// ----------- Schema & Types ------------
const dateRangeSchema = z.object({
  from: z.date(),
  to: z.date(),
});

const ticketClassSchema = z.object({
  id: z.string().min(1, "Ticket class ID is required"),
  type: z.enum(AttendancePolicyType, {
    error: "You must select an attendance policy!",
  }),
  description: z.string().min(1, "Description is required"),
  price: z.number().min(0, "Price must be non-negative"),
});

const eventFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  banner: z.instanceof(FileList),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  dates: z.array(dateRangeSchema).min(1, "At least one date range is required"),
  ticketClasses: z
    .array(ticketClassSchema)
    .min(1, "At least one ticket class is required"),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

// ----------- Component ------------
export default function EventForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      dates: [],
      ticketClasses: [],
    },
  });

  const [fileName, setFileName] = useState<string | undefined>();

  const provider = useContext(TickettoClientContext);

  const [openPicker, setOpenPicker] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "ticketClasses",
  });

  const onSubmit = async (data: EventFormValues) => {
    if (!provider) {
      setToast({
        open: true,
        message: "Ticketto provider is not ready yet. Please try again.",
        severity: "error",
      });
      return;
    }

    try {
      const eventId = await provider.events.calls.createEvent({
        capacity: BigInt(data.capacity),
        metadata: {
          banner: data.banner.item(0)?.webkitRelativePath,
          description: data.description,
        },
        class: {
          attendancePolicy: {
            type: AttendancePolicyType.Single,
          },
          ticketprice: {
            amount: BigInt(data.ticketClasses[0].price),
            asset: {
              code: "dUSD",
              decimals: 6,
              id: 50_000_002,
            },
          },
          ticketRestrictions: {
            cannotResale: false,
            cannotTransfer: false,
          },
        },
        name: data.name,
        dates: [
          [
            BigInt(data.dates[0].from.getTime()),
            BigInt(data.dates[0].to.getTime()),
          ],
        ],
      });

      console.log("Event submitted:", data);
      console.log(eventId);

      setToast({
        open: true,
        message: "Event created successfully",
        severity: "success",
      });

      setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        message:
          e instanceof Error
            ? `Error creating event: ${e.message}`
            : "Unexpected error creating the event",
        severity: "error",
      });
    }
  };

  const handleToastClose = (
    _event?: SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") return;
    setToast((previous) => ({ ...previous, open: false }));
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        p: 4,
        maxWidth: 600,
        mx: "auto",
        margin: "auto",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        justifyContent: "center",
      }}
    >
      <Typography variant="h5" gutterBottom>
        Create Event
      </Typography>

      <Stack spacing={3}>
        <TextField
          label="Name"
          {...register("name")}
          error={!!errors.name}
          helperText={errors.name?.message}
        />

        <TextField
          label="Description"
          {...register("description")}
          error={!!errors.description}
          helperText={errors.description?.message}
          multiline
          minRows={3}
        />

        <Box>
          <InputLabel>Banner</InputLabel>
          <Button variant="outlined" component="label">
            Upload File
            <input
              type="file"
              hidden
              {...register("banner")}
              onChange={(e) => {
                register("banner").onChange(e);
                setFileName(e.target.value.split("\\").pop());
              }}
            />
          </Button>
          <Typography color="textPrimary" variant="body2">
            {fileName}
          </Typography>
          {errors.banner && (
            <Typography color="error" variant="body2">
              {errors.banner.message as string}
            </Typography>
          )}
        </Box>

        <TextField
          label="Capacity"
          type="number"
          {...register("capacity", { valueAsNumber: true })}
          error={!!errors.capacity}
          helperText={errors.capacity?.message}
        />

        <Box>
          <TextField
            label="Event dates"
            variant="outlined"
            hiddenLabel={false}
            onClick={() => setOpenPicker(true)}
            value={`${
              control._formValues.dates[0]?.from.toLocaleDateString("en-US") ??
              ""
            } - ${
              control._formValues.dates[0]?.to.toLocaleDateString("en-US") ?? ""
            }`}
            contentEditable={false}
          >
            Select event dates
          </TextField>
          <DateRangePicker
            open={openPicker}
            toggle={() => setOpenPicker(!openPicker)}
            onChange={(range) => {
              if (range.startDate && range.endDate) {
                setValue("dates", [
                  { from: range.startDate, to: range.endDate },
                ]);
              }
              setOpenPicker(false);
            }}
          />
          {errors.dates && (
            <Typography color="error" variant="body2">
              {errors.dates.message as string}
            </Typography>
          )}
        </Box>

        <Box>
          <Typography variant="h6">Ticket Classes</Typography>
          <Stack spacing={2}>
            {fields.map((field, index) => (
              <Box
                key={field.id}
                sx={{ border: "1px solid #ccc", borderRadius: 2, p: 2 }}
              >
                <Stack spacing={2}>
                  <TextField
                    label="ID"
                    {...register(`ticketClasses.${index}.id` as const)}
                    error={!!errors.ticketClasses?.[index]?.id}
                    helperText={errors.ticketClasses?.[index]?.id?.message}
                  />
                  <TextField
                    label="Description"
                    {...register(`ticketClasses.${index}.description` as const)}
                    error={!!errors.ticketClasses?.[index]?.description}
                    helperText={
                      errors.ticketClasses?.[index]?.description?.message
                    }
                  />
                  <FormControl>
                    <InputLabel id="demo-simple-select-standard-label">
                      Kind of ticket
                    </InputLabel>
                    <Select
                      label="Kind of ticket"
                      labelId="demo-simple-select-standard-label"
                      id="demo-simple-select-standard"
                      {...register(`ticketClasses.${index}.type` as const)}
                      error={!!errors.ticketClasses?.[index]?.type}
                      defaultValue={AttendancePolicyType.Single}
                    >
                      {Object.values(AttendancePolicyType).map((value) => (
                        <MenuItem value={value} key={`kind-${value}`}>
                          {value}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Price"
                    type="number"
                    {...register(`ticketClasses.${index}.price`, {
                      valueAsNumber: true,
                    })}
                    error={!!errors.ticketClasses?.[index]?.price}
                    helperText={errors.ticketClasses?.[index]?.price?.message}
                  />
                  <IconButton onClick={() => remove(index)} aria-label="delete">
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              </Box>
            ))}
          </Stack>

          {fields.length < 1 && (
            <Button
              sx={{ mt: 2 }}
              variant="outlined"
              onClick={() =>
                append({
                  id: "",
                  description: "",
                  price: 0,
                  type: AttendancePolicyType.Single,
                })
              }
            >
              Add ticket class
            </Button>
          )}

          {typeof errors.ticketClasses?.message === "string" && (
            <Typography color="error" variant="body2">
              {errors.ticketClasses.message}
            </Typography>
          )}
        </Box>

        <Divider />

        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? <CircularProgress size={18} color="inherit" /> : null
          }
        >
          {isSubmitting ? "Submitting…" : "Submit Event"}
        </Button>
      </Stack>
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleToastClose}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
