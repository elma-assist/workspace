"use client";
import { useState, useEffect } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  Alert,
  Badge,
  Group,
  Modal as MantineModal,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Anchor,
  Paper,
} from "@mantine/core";
import { AlertCircle, Bot, Inbox } from "lucide-react";
export function Logo() {
  return (
    <Anchor href="/" underline="never" c="inherit">
      <Group gap="xs">
        <ThemeIcon size={32}>
          <Bot size={20} />
        </ThemeIcon>
        <Text fw={700} size="lg">
          elma
        </Text>
      </Group>
    </Anchor>
  );
}
export function Modal({
  title,
  children,
  onClose,
  compact = false,
  closeDisabled = false,
}: {
  title: string;
  compact?: boolean;
  closeDisabled?: boolean;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const mobile = useMediaQuery("(max-width: 48em)");
  useEffect(() => setOpened(true), []);
  return (
    <MantineModal
      opened={opened}
      onClose={() => {
        if (!closeDisabled) setOpened(false);
      }}
      closeOnClickOutside={!closeDisabled}
      closeOnEscape={!closeDisabled}
      onExitTransitionEnd={onClose}
      title={title}
      centered
      size={compact ? "md" : "lg"}
      fullScreen={mobile && !compact}
      overlayProps={{ backgroundOpacity: 0.35 }}
      closeButtonProps={{ "aria-label": "Close", disabled: closeDisabled }}
    >
      <Stack gap="md">{children}</Stack>
    </MantineModal>
  );
}
export function EditorPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="lg" maw={760}>
      <Title order={1} size="h2">
        {title}
      </Title>
      <Paper withBorder radius="md" p={{ base: "md", sm: "xl" }}>
        <Stack gap="md">{children}</Stack>
      </Paper>
    </Stack>
  );
}
export function EmptyState({
  title = "Nothing here yet",
  description,
  icon,
  action,
  compact = false,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Paper
      withBorder
      radius="md"
      p={compact ? "md" : "xl"}
      w="100%"
      bg="var(--mantine-color-gray-0)"
    >
      <Stack align="center" gap="sm" py={compact ? "xs" : "lg"} ta="center">
        <ThemeIcon
          variant="light"
          color="gray"
          size={compact ? 36 : 44}
          radius="xl"
        >
          {icon ?? <Inbox size={compact ? 18 : 22} />}
        </ThemeIcon>
        <Title order={3} size="h5">
          {title}
        </Title>
        {description && (
          <Text c="dimmed" size="sm" maw={420}>
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </Paper>
  );
}
export function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <Alert color="red" icon={<AlertCircle size={18} />} role="alert">
      {error}
    </Alert>
  ) : null;
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      variant="light"
      color={
        ["ready", "active", "completed"].includes(value)
          ? "teal"
          : ["failed", "error"].includes(value)
            ? "red"
            : "gray"
      }
    >
      {value}
    </Badge>
  );
}
