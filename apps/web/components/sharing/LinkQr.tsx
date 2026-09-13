"use client";
import { Button } from "../AsyncAction";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Image,
  Alert,
  Box,
} from "@mantine/core";
import { Copy, Download } from "lucide-react";
import { ErrorNotice } from "../ui";

export function LinkQr({
  url,
  filename,
  compact = false,
}: {
  url: string;
  filename?: string;
  compact?: boolean;
}) {
  const [png, setPng] = useState(""),
    [svg, setSvg] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    setPng("");
    setSvg("");
    setCopied(false);
    setError("");
    Promise.all([
      QRCode.toDataURL(url, {
        width: 1024,
        margin: 4,
        errorCorrectionLevel: "M",
      }),
      compact
        ? Promise.resolve("")
        : QRCode.toString(url, {
            type: "svg",
            margin: 4,
            errorCorrectionLevel: "M",
          }),
    ])
      .then(([p, s]) => {
        if (active) {
          setPng(p);
          setSvg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(s));
        }
      })
      .catch(() => {
        if (active) setError("Could not generate QR code");
      });
    return () => {
      active = false;
    };
  }, [url, compact]);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(url).hostname,
  );
  const linkControls = (
    <Stack gap="sm" miw={0}>
      <TextInput
        label="Share link"
        value={url}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        variant="light"
        leftSection={<Copy size={16} />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setError("Select the link above and copy it manually.");
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </Stack>
  );
  const qr = png ? (
    <Image
      src={png}
      alt="QR code for this link"
      w={compact ? "100%" : 224}
      h={compact ? "auto" : 224}
      style={{ aspectRatio: "1" }}
      maw="100%"
      mx="auto"
    />
  ) : (
    <Box
      w={compact ? "100%" : 224}
      maw="100%"
      mx="auto"
      style={{ aspectRatio: "1" }}
    />
  );
  return (
    <Stack gap="md">
      {compact ? (
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
            gap: "var(--mantine-spacing-md)",
            alignItems: "center",
          }}
        >
          {qr}
          {linkControls}
        </Box>
      ) : (
        <>
          {linkControls}
          {qr}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Button
              component="a"
              href={png || undefined}
              download={`${filename}.png`}
              disabled={!png}
              variant="default"
              leftSection={<Download size={16} />}
            >
              Download PNG
            </Button>
            <Button
              component="a"
              href={svg || undefined}
              download={`${filename}.svg`}
              disabled={!svg}
              variant="default"
            >
              Download SVG
            </Button>
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            PNG is 1024 × 1024. SVG stays sharp at any print size.
          </Text>
          {local && (
            <Alert color="yellow">
              This is a local address. To open it on another device, the
              platform needs a reachable HTTPS address.
            </Alert>
          )}
        </>
      )}
      <ErrorNotice error={error} />
    </Stack>
  );
}
