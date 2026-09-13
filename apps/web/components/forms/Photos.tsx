"use client";
import { useRouteState } from "../../hooks/useRouteState";
import { Modal } from "../ui";
import { Button } from "../AsyncAction";
import { UnstyledButton } from "@mantine/core";
import { useEffect, useState } from "react";
import { Image, Text, Stack, Group, FileButton, Progress } from "@mantine/core";
import { Upload, Trash2 } from "lucide-react";
import { Session } from "../../lib/api";
import { Attachment, guestHeaders } from "../../lib/forms";
function Photo({
  url,
  name,
  session,
}: {
  url: string;
  name: string;
  session?: Session;
}) {
  const [photo, setPhoto] = useRouteState("photo");
  const id = url.split("/").pop()!;
  const [src, setSrc] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true,
      object = "";
    fetch(url, {
      credentials: "include",
      headers: session ? guestHeaders(session) : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((b) => {
        if (active) {
          object = URL.createObjectURL(b);
          setSrc(object);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [url, session?.id]);
  return src ? (
    <>
      <UnstyledButton onClick={() => setPhoto(id)} aria-label={`View ${name}`}>
        <Image src={src} alt={name} h={100} w={120} radius="sm" fit="cover" />
      </UnstyledButton>
      {photo === id && (
        <Modal title={name} onClose={() => setPhoto(null)}>
          <Image src={src} alt={name} fit="contain" mah="75dvh" />
        </Modal>
      )}
    </>
  ) : (
    <Text size="xs">{error ? "Preview unavailable" : "Loading photo…"}</Text>
  );
}
export function Photos({
  files,
  base,
  session,
  upload,
  remove,
  busy = false,
}: {
  files: Attachment[];
  base: string;
  session?: Session;
  upload?: (file: File) => void;
  remove?: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <Stack gap="xs">
      <Group align="start">
        {files.map((f) => (
          <Stack key={f.id} gap={4} maw={130}>
            <Photo url={`${base}/${f.id}`} name={f.name} session={session} />
            <Text size="xs" truncate>
              {f.name}
            </Text>
            {remove && (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                disabled={busy}
                leftSection={<Trash2 size={14} />}
                onClick={() => remove(f.id)}
              >
                Remove
              </Button>
            )}
          </Stack>
        ))}
      </Group>
      {upload && (
        <>
          <FileButton
            onChange={(f) => {
              if (f) upload(f);
            }}
            accept="image/jpeg,image/png,image/webp"
          >
            {(props) => (
              <Button
                {...props}
                variant="light"
                loading={busy}
                disabled={busy || files.length >= 5}
                leftSection={<Upload size={16} />}
              >
                Add photo
              </Button>
            )}
          </FileButton>
          <Text size="xs" c="dimmed">
            JPEG, PNG or WebP · Up to 5 photos, 8 MB each. Photos are resized
            and location metadata removed.
          </Text>
        </>
      )}
      {busy && (
        <>
          <Progress animated value={100} aria-label="Uploading photo" />
          <Text size="xs" role="status">
            Uploading photo…
          </Text>
        </>
      )}
    </Stack>
  );
}
