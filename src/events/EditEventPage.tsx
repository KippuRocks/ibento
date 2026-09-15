import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { navigate } from "../screens/router";
import { Screen } from "../screens/Screen";
import { ScreenLink } from "../screens/ScreenLink";
import {
  detailsOf,
  detailsProblems,
  type EventDetailsDraft,
  eventDocument,
  type ImageDraft,
  zoneNameOf,
} from "./document";
import { DetailsStep, TextField } from "./fields";
import { base64Of, IMAGE_TYPES, imageProblem, isImageType } from "./images";
import { type EventView, eventName } from "./view";

function Imagery({
  event,
  images,
  onChange,
}: {
  event: string;
  images: readonly ImageDraft[];
  onChange: (images: readonly ImageDraft[]) => void;
}) {
  const trpc = useTRPC();
  const [problem, setProblem] = useState<string | null>(null);
  const upload = useMutation(trpc.metadata.images.upload.mutationOptions());

  async function chosen(change: ChangeEvent<HTMLInputElement>) {
    const input = change.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (file === undefined) {
      return;
    }
    const refused = imageProblem(file);
    setProblem(refused);
    if (refused !== null || !isImageType(file.type)) {
      return;
    }
    const uploaded = await upload.mutateAsync({
      event,
      mediaType: file.type,
      data: await base64Of(file),
    });
    onChange([...images, { url: uploaded.url, alt: "", mediaType: uploaded.mediaType }]);
  }

  const setImage = (index: number, image: ImageDraft) =>
    onChange(images.map((existing, at) => (at === index ? image : existing)));

  return (
    <fieldset>
      <legend>Images</legend>
      <p className="hint">
        JPEG, PNG or WebP, at most 2 MiB each. Images are public as soon as they are uploaded, and
        appear on the event once you save.
      </p>
      {images.length === 0 ? <p>No images.</p> : null}
      {images.map((image, index) => (
        <div className="group" key={image.url} data-testid="event-image">
          <code className="url">{image.url}</code>
          <TextField
            label={`Image ${index + 1} description`}
            value={image.alt}
            onChange={(alt) => setImage(index, { ...image, alt })}
            hint="Describes the image for people who cannot see it."
          />
          <button type="button" onClick={() => onChange(images.filter((_, at) => at !== index))}>
            Remove image {index + 1}
          </button>
        </div>
      ))}
      <div className="field">
        <label htmlFor="event-image-upload">Add an image</label>
        <input
          id="event-image-upload"
          type="file"
          accept={IMAGE_TYPES.join(",")}
          disabled={upload.isPending}
          onChange={(change) => {
            chosen(change).catch(() => undefined);
          }}
        />
      </div>
      {upload.isPending ? <p role="status">Uploading the image…</p> : null}
      {problem !== null ? (
        <p role="alert" className="error">
          {problem}
        </p>
      ) : null}
      {upload.isError ? (
        <p role="alert" className="error">
          {describeFailure(upload.error)}
        </p>
      ) : null}
    </fieldset>
  );
}

function EditForm({ event }: { event: EventView }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [details, setDetails] = useState<EventDetailsDraft>(() => detailsOf(event.metadata));
  const [zoneNames, setZoneNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(event.zones.map((zone) => [zone.id, zoneNameOf(event.metadata, zone.id)])),
  );
  const [problems, setProblems] = useState<readonly string[]>([]);

  const save = useMutation(
    trpc.metadata.events.put.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.derived.events.pathKey() });
        navigate("event.edit", "event.detail", { event: event.id });
      },
    }),
  );

  function submit() {
    const found = detailsProblems(details);
    setProblems(found);
    if (found.length > 0) {
      return;
    }
    save.mutate({
      event: event.id,
      document: eventDocument(
        event.id,
        details,
        event.zones.map((zone) => ({ id: zone.id, name: zoneNames[zone.id] ?? "" })),
        event.metadata,
      ),
    });
  }

  return (
    <form
      onSubmit={(submitted) => {
        submitted.preventDefault();
        submit();
      }}
    >
      <DetailsStep details={details} onChange={setDetails} />
      {event.zones.length > 0 ? (
        <fieldset>
          <legend>Zone names</legend>
          {event.zones.map((zone, index) => (
            <TextField
              key={zone.id}
              label={`Zone ${index + 1} name (${zone.kind})`}
              value={zoneNames[zone.id] ?? ""}
              onChange={(name) => setZoneNames((current) => ({ ...current, [zone.id]: name }))}
            />
          ))}
        </fieldset>
      ) : null}
      <Imagery
        event={event.id}
        images={details.imagery}
        onChange={(imagery) => setDetails((current) => ({ ...current, imagery }))}
      />
      {problems.length > 0 ? (
        <ul role="alert" className="error">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {save.isError ? (
        <p role="alert" className="error">
          {describeFailure(save.error)}
        </p>
      ) : null}
      <p className="hint">
        Saving replaces the event's public document. Nothing is written to the ledger.
      </p>
      <div className="actions">
        <ScreenLink from="event.edit" to="event.detail" params={{ event: event.id }}>
          Cancel
        </ScreenLink>
        <button type="submit" disabled={save.isPending}>
          Save changes
        </button>
      </div>
    </form>
  );
}

/**
 * Edits an event's public metadata document (`US-A3`): details, zone names and
 * images. An edit writes the document and nothing else — no ledger write occurs
 * (`AC-A3.1`).
 */
export function EditEventPage({ event }: { event: string }) {
  return (
    <Screen id="event.edit">
      <EditEvent event={event} />
    </Screen>
  );
}

function EditEvent({ event: id }: { event: string }) {
  const trpc = useTRPC();
  const read = useQuery(
    trpc.derived.events.get.queryOptions(
      { event: id },
      { refetchInterval: (query) => (query.state.data?.event === null ? 1000 : false) },
    ),
  );
  if (read.isPending) {
    return <p>Loading the event…</p>;
  }
  if (read.isError) {
    return (
      <p role="alert" className="error">
        {describeFailure(read.error)}
      </p>
    );
  }
  const { event } = read.data;
  if (event === null) {
    return <p>Kippu's copy of the ledger has not recorded this event yet.</p>;
  }
  return (
    <section>
      <h1>Edit {eventName(event)}</h1>
      {/* The form starts from the document as read, and is not refreshed under the organiser's edits. */}
      <EditForm event={event} />
    </section>
  );
}
