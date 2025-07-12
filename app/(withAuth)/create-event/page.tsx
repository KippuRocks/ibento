"use client";

import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@mui/material/Input";
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
} from "@mui/material";
import { DateRangePicker } from "mui-daterange-picker";
import { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import { client } from "@/cli/client";

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
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      dates: [],
      ticketClasses: [],
    },
  });

  const [openPicker, setOpenPicker] = useState(false);
  const { fields, append, remove } = useFieldArray({
    control,
    name: "ticketClasses",
  });

  const onSubmit = async (data: EventFormValues) => {
    const eventId = await client.events.calls.createEvent({
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
  };
  console.log(control._formValues);

  client.events.query.all().then(console.log);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ p: 4, maxWidth: 600, mx: "auto" }}
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
          <Input type="file" {...register("banner")} />
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
            Seleccionar fechas del evento
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
              Añadir ticket class
            </Button>
          )}

          {typeof errors.ticketClasses?.message === "string" && (
            <Typography color="error" variant="body2">
              {errors.ticketClasses.message}
            </Typography>
          )}
        </Box>

        <Divider />

        <Button type="submit" variant="contained">
          Submit Event
        </Button>
      </Stack>
    </Box>
  );
}
