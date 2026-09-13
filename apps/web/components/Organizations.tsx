"use client";
import { Button } from "./AsyncAction";
import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  ThemeIcon,
} from "@mantine/core";
import { Building2, Plus } from "lucide-react";
import { Organization } from "../lib/api";
import { EmptyState } from "./ui";
export function Organizations({
  items,
  open,
  create,
}: {
  items: Organization[];
  open: (org: Organization) => void;
  create: () => void;
}) {
  return (
    <Stack gap="xl">
      <Group justify="space-between">
        <div>
          <Title order={1} size="h2">
            My organizations
          </Title>
          <Text c="dimmed" mt="xs">
            Choose a workspace to manage its agents, knowledge and
            conversations.
          </Text>
        </div>
        <Button leftSection={<Plus size={16} />} onClick={create}>
          Create organization
        </Button>
      </Group>
      {!items.length && <EmptyState />}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {items.map((org) => (
          <Card
            key={org.id}
            component="button"
            type="button"
            withBorder
            padding="lg"
            radius="md"
            className="object-card"
            onClick={() => open(org)}
            aria-label={`Open ${org.name}`}
          >
            <Stack>
              <Group justify="space-between">
                <ThemeIcon variant="light" size="lg">
                  <Building2 size={20} />
                </ThemeIcon>
                <Badge variant="light">{org.role}</Badge>
              </Group>
              <Title order={2} size="h4">
                {org.name}
              </Title>
              <Text size="sm" c="dimmed">
                {org.slug}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
